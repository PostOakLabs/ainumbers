#!/usr/bin/env node
/**
 * scripts/gen-rss.mjs — FEED-TWINS-1 (2026-09-22): the estate's RSS 2.0 change feed.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * Renders `rss.xml` at the repo root so change-feed readers can discover estate
 * updates without scraping HTML. Registered for discovery the same way every
 * other root page is: a `published-dirs.json` `rootPages` entry, consumed by
 * `regen-sitemap.mjs` (the sitemap's single writer) and readable by
 * `verify_repo.py check_sitemap`, which reads that same manifest.
 *
 * ── THE ONE CONTENT LAW: PUBLIC LOCAL SIGNALS ONLY ─────────────────────────
 * Items derive from exactly two sources, both already public and both read
 * from the LOCAL tree (no network, no scraping, no board/ sources):
 *
 *   1. The merged tool manifest `mcp/server.json` — its `last_updated` date
 *      (maintained by `regen_catalog.py`, which keeps the PRIOR date unless the
 *      tool set actually changed) becomes one "tool registry updated" item.
 *   2. Release-shaped git tags — `git tag --list 'v*'` only. Working tags
 *      (the repo carries exactly one, and it is not release-shaped) can never
 *      leak into the feed because the glob is the filter.
 *
 * ⛔ Never scraped from HTML, never derived from chaingraph.json, never sourced
 * from board/ or any internal surface. This generator deliberately contains no
 * reference to the node graph: it is NOT node-sensitive (NODE-FANOUT-REGEN-CLOSE-1's
 * source-text heuristic must keep classifying it out), so it declares no
 * `after:` ordering edge — it consumes only committed bytes and local git.
 *
 * ⛔ NO WALL CLOCK anywhere in the output (the idempotency law every writer in
 * `derived-artifacts.mjs` COVERED is held to, measured by content hash):
 * `lastBuildDate` = the newest item date, not `new Date()`. Two runs on the
 * same committed tree produce byte-identical output — that is what makes the
 * main-side auto-commit chain converge instead of churning.
 *
 * ── SINGLE WRITER (SO #35) ─────────────────────────────────────────────────
 * `rss.xml` is a shared derived artifact: COVERED id `rss` in
 * `scripts/derived-artifacts.mjs`. The write half below runs main-side in
 * `derived-artifacts-regen.yml`; a PR is FORBIDDEN from satisfying the
 * freshness gate by re-running the writer (advisory-on-PR / blocking-on-main
 * via the generic downgrade built from this file's COVERED `gate` string).
 *
 * rss.xml escapes the copy-hallmarks and egress scans (both HTML-only) — this
 * generator's own --check gate plus its self-test are the ONLY net over this
 * surface, so both are wired into scripts/preflight.mjs GATES.
 *
 * Usage:
 *   node scripts/gen-rss.mjs           # write rss.xml (regen half, main-side)
 *   node scripts/gen-rss.mjs --check   # freshness gate (exit 1 if stale)
 *   node scripts/gen-rss.mjs --self-test  # in-memory RED/GREEN controls (SO #40b)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
const OUT_PATH = resolve(REPO, 'rss.xml');
const SERVER_MANIFEST_PATH = resolve(REPO, 'mcp', 'server.json');
const BASE = 'https://ainumbers.co';
// The release-shape filter IS the content policy for the git half of the feed:
// only release-shaped tags (`v<digit>*`) are publishable, so working tags can
// never leak. Measured at claim (2026-09-22, main 5ec38ffc): the repo carries
// exactly one tag and it is not release-shaped, so the git half contributes
// ZERO items today — the code path stays generic (and self-tested) for the day
// a release tag lands. The shape is enforced TWICE (git's --list glob AND the
// in-process /^v\d/ filter below) so neither layer alone is the only net.
const RELEASE_TAG_GLOB = 'v[0-9]*';

const CHANNEL_TITLE = 'AINumbers change feed';
const CHANNEL_LINK = `${BASE}/`;
const CHANNEL_DESCRIPTION =
  'Machine-readable change feed for ainumbers.co: tool-registry updates and ' +
  'release tags, generated from public local signals.';

// ── pure helpers (the self-test drives these directly, in memory) ───────────

export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `YYYY-MM-DD` → RFC 822 date at UTC midnight, via a fixed table (never
 * `toLocaleString` — locale-dependent output is non-deterministic bytes).
 * "2026-09-06" → "Sun, 06 Sep 2026 00:00:00 +0000". Returns null for anything
 * that is not a plain YYYY-MM-DD string, so a malformed manifest date FAILS
 * the run instead of rendering garbage.
 */
export function rfc822(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${DAY_NAMES[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()} 00:00:00 +0000`;
}

/** Sort: newest first; tie-break on title ascending so ordering is total. */
export function sortByRecency(items) {
  return [...items].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.title.localeCompare(b.title));
}

/**
 * The feed is a pure string function of the item list — no I/O, no clock.
 * Exported for the self-test; `main()` is the only caller that touches disk.
 */
export function buildFeed(unsortedItems) {
  const items = sortByRecency(unsortedItems);
  const newest = items.reduce((max, it) => (max === null || it.date > max ? it.date : max), null);
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<rss version="2.0">');
  lines.push('  <channel>');
  lines.push(`    <title>${xmlEscape(CHANNEL_TITLE)}</title>`);
  lines.push(`    <link>${xmlEscape(CHANNEL_LINK)}</link>`);
  lines.push(`    <description>${xmlEscape(CHANNEL_DESCRIPTION)}</description>`);
  lines.push(`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`);
  for (const it of items) {
    lines.push('    <item>');
    lines.push(`      <title>${xmlEscape(it.title)}</title>`);
    lines.push(`      <link>${xmlEscape(it.link)}</link>`);
    lines.push(`      <guid isPermaLink="false">${xmlEscape(it.guid)}</guid>`);
    lines.push(`      <pubDate>${rfc822(it.date)}</pubDate>`);
    lines.push(`      <description>${xmlEscape(it.description)}</description>`);
    lines.push('    </item>');
  }
  lines.push('  </channel>');
  lines.push('</rss>');
  return lines.join('\n') + '\n';
}

/**
 * The gate's comparison, factored out so the self-test can drive the EXACT
 * predicate the --check mode applies (SO #40b: test the real function).
 * Returns null when fresh, or a one-line reason when stale.
 */
export function stalenessReason(expected, actual) {
  if (actual === expected) return null;
  if (!actual || !actual.trim()) return 'rss.xml is missing or empty';
  return 'rss.xml is stale — run: node scripts/gen-rss.mjs';
}

/**
 * The git half: release-shaped tags only, dated by the tagged commit
 * (a local signal — `git log` of the tag, not the wall clock, not the network).
 * Spawned through gitEnv() (GIT-ENV-LEAK-SWEEP-1: a hook-inherited GIT_DIR must
 * never redirect the answer to some outer repository). A checkout with no git
 * or no matching tags yields an empty list — never an error, never an item.
 */
export function releaseTagItems(glob = RELEASE_TAG_GLOB, run = (args) =>
  execFileSync('git', args, { cwd: REPO, env: gitEnv(), encoding: 'utf8' }).trim()) {
  let tags;
  try {
    tags = run(['tag', '--list', glob]).split('\n').map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
  // Second, in-process enforcement of the release shape — git's glob is the
  // first net, never the only one (the feed's content law must not depend on
  // one layer).
  tags = tags.filter((t) => /^v\d/.test(t));
  const items = [];
  for (const tag of tags) {
    let date;
    try {
      date = run(['log', '-n', '1', '--format=%cI', tag]).slice(0, 10);
    } catch {
      continue; // a broken tag object is skipped, never invented around
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    items.push({
      title: `Release ${tag}`,
      link: CHANNEL_LINK,
      guid: `release-${tag}`,
      date,
      description: `Release tag ${tag} is live on the main site.`,
    });
  }
  return items;
}

/**
 * The manifest half: ONE item from the merged tool manifest's own
 * `last_updated` (regen_catalog.py keeps that date stable across no-op regens,
 * so this item moves only when the tool set actually moves).
 */
export function toolManifestItems(serverManifest = JSON.parse(readFileSync(SERVER_MANIFEST_PATH, 'utf8'))) {
  const date = serverManifest.last_updated;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw new Error(`mcp/server.json has no parsable last_updated date — refusing to invent one`);
  }
  const count = serverManifest.tool_count;
  return [{
    title: `Tool registry updated: ${count} tools`,
    link: `${BASE}/tools.html`,
    guid: `tool-registry-${date}`,
    date,
    description:
      `The merged tool manifest (${serverManifest.name}, version ${serverManifest.version}) ` +
      `now covers ${count} published tools.`,
  }];
}

function main() {
  if (process.argv.includes('--self-test')) { selfTest(); return; }
  const expected = buildFeed([...toolManifestItems(), ...releaseTagItems()]);

  if (process.argv.includes('--check')) {
    const actual = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : '';
    const reason = stalenessReason(expected, actual);
    if (reason) {
      console.error(`gen-rss --check FAIL: ${reason}`);
      process.exit(1);
    }
    console.log('gen-rss --check: OK (rss.xml fresh).');
    process.exit(0);
  }

  writeFileSync(OUT_PATH, expected, 'utf8');
  console.log(`gen-rss: written (${expected.split('<item>').length - 1} items).`);
}

// ── self-test (SO #40b: the checker must be shown RED, not merely read green).
// In-memory only: drives buildFeed/stalenessReason/rfc822/sort/escape — the
// exact functions the writer and the gate both use — over fixtures. ──────────
function selfTest() {
  const failures = [];
  const expect = (name, cond) => { if (!cond) failures.push(name); };

  // GREEN control: the feed is a fixpoint of its own builder (idempotence).
  const items = [
    { title: 'Tool registry updated: 665 tools', link: `${BASE}/tools.html`, guid: 'tool-registry-2026-09-06', date: '2026-09-06', description: 'The merged tool manifest now covers 665 published tools.' },
    { title: 'Release v1.0.0', link: CHANNEL_LINK, guid: 'release-v1.0.0', date: '2026-09-01', description: 'Release tag v1.0.0 is live on the main site.' },
  ];
  expect('buildFeed is deterministic (two runs, one bytes)', buildFeed(items) === buildFeed(items));

  // RED control: a tampered feed IS detected by the gate predicate. The
  // mutation is applied to RENDERED bytes (the item title), not to a source
  // date literal — dates render as RFC 822, so a source-format replace would
  // be a silent no-op and prove nothing (this control caught exactly that).
  const expected = buildFeed(items);
  const tampered = expected.replace('665 tools', '664 tools');
  expect('tampering is a real mutation (bytes differ)', tampered !== expected);
  expect('stalenessReason flags a mutated item', stalenessReason(expected, tampered) !== null);
  // …and an emptied file is flagged too.
  expect('stalenessReason flags a missing/empty feed', stalenessReason(expected, '') !== null);
  // GREEN control: identical bytes pass the same predicate.
  expect('stalenessReason passes identical bytes', stalenessReason(expected, expected) === null);

  // RED control: escaping is load-bearing — a raw `&` in a title must never
  // reach the bytes unescaped (this is the net over an HTML-unscanned surface).
  const nasty = buildFeed([{ title: 'A & B <c> "d" \'e\'', link: CHANNEL_LINK, guid: 'g', date: '2026-01-01', description: 'x' }]);
  expect('raw & would differ from escaped output', nasty.includes('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;'));
  expect('no raw <item>-level ampersand survives', !/&(?!(amp|lt|gt|quot|apos);)/.test(nasty.replace(/<\?xml[^>]*\?>/, '')));

  // RFC 822 rendering is table-driven and exact (no locale, no clock).
  expect('rfc822 known value', rfc822('2026-09-06') === 'Sun, 06 Sep 2026 00:00:00 +0000');
  expect('rfc822 leap-day', rfc822('2028-02-29') === 'Tue, 29 Feb 2028 00:00:00 +0000');
  expect('rfc822 rejects garbage (returns null, run fails later)', rfc822('not-a-date') === null);

  // Recency sort: newest first, total order under ties.
  const sorted = sortByRecency([
    { title: 'b', date: '2026-09-01' },
    { title: 'a', date: '2026-09-01' },
    { title: 'z', date: '2026-12-31' },
  ]);
  expect('sort newest-first with title tie-break', sorted.map((i) => i.title).join(',') === 'z,a,b');

  // Tag filter discipline: a working tag can never leak (the glob is the law).
  const fakeRun = (args) => (args[0] === 'tag' ? 'v1.0.0\nSPRW1-GENIUS-prerebase' : '2026-01-15T00:00:00-05:00');
  const tagItems = releaseTagItems('v*', fakeRun);
  expect('non-release tags are filtered', tagItems.length === 1 && tagItems[0].title === 'Release v1.0.0');
  expect('tag date is the commit date, truncated to YYYY-MM-DD', tagItems[0]?.date === '2026-01-15');
  expect('git failure yields zero items (never an invented item)', releaseTagItems('v*', () => { throw new Error('no git'); }).length === 0);

  if (failures.length) {
    console.error(`✗ gen-rss self-test FAILED — ${failures.length} control(s):`);
    for (const f of failures) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`✓ gen-rss self-test clean — determinism, staleness RED/GREEN, XML escaping, RFC 822 table, recency sort, tag-glob filter (2 RED-class mutations caught).`);
}

main();
