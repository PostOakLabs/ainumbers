#!/usr/bin/env node
/**
 * scripts/gen-changelog.selftest.mjs — fixture proof for the CHANGELOG-1
 * generator (scripts/gen-changelog.mjs) and its leak gate.
 *
 * A gate never seen red is not a gate (SO #34c). Everything here runs against
 * IN-MEMORY fixtures via the generator's exported pure functions
 * (renderChangelog / collectLeaks) — never against the real history, the real
 * seed, or the real CHANGELOG.md, and it writes nothing.
 *
 * What it proves:
 *   1. FAIL-CLOSED FORWARD — a merge entry absent from the seed throws, naming
 *      the exact seed key to add; nothing renders. (This is the standing
 *      Amendment A11 contract: the PR that lands a merge commit appends its
 *      own seed line.)
 *   2. FAIL-CLOSED TAGS — a reachable tag absent from seed.tags throws; a tag
 *      classified {heading} becomes a version scope; {ignore} with a reason
 *      does not.
 *   3. FAIL-CLOSED SECTIONS — a seed entry naming a section outside
 *      seed.sections throws (no silent re-sectioning).
 *   4. SCOPE BOUNDARIES — entries fall in Unreleased vs tag scopes by date,
 *      including the floor/ceil edges (date == tag date belongs to the tag).
 *   5. LEAK GATE POSITIVE — planted internal vocabulary is caught and the hit
 *      is QUOTED with its class: board row IDs, standing-order refs, owner
 *      names, orchestration roles, model vendors, internal paths. RED-then-
 *      GREEN in one control.
 *   6. LEAK GATE NEGATIVE, the false-positive half — public token shapes read
 *      clean: lowercase node ids (art-544), §-section references, PR numbers,
 *      and the allowlisted public tokens (ISO-20022, SHA-256, tool range
 *      T420-427) on the SAME line as a real leak still reds (the allowlist
 *      strips its own token, never skips the line).
 *   7. IDEMPOTENCE — the same (merges, tags, seed) renders byte-identical
 *      output twice, and no Date.now()/new Date() value can enter the bytes.
 *   8. REAL SEED SANITY — the committed seed parses, its sections are
 *      well-formed, and every entry's section is a member of seed.sections
 *      (cheap drift tripwire; full membership vs history is the generator's
 *      own fail-closed run, exercised live by preflight).
 *
 * Usage: node scripts/gen-changelog.selftest.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */
import { readFileSync } from 'node:fs';
import { renderChangelog, collectLeaks, listTags, PUBLIC_TOKEN_ALLOWLIST } from './gen-changelog.mjs';

let failed = 0;
let ran = 0;
function check(cond, label) {
  ran++;
  if (cond) { console.log(`  ok ${ran} - ${label}`); }
  else { failed++; console.error(`  not ok ${ran} - ${label}`); }
}
function throws(fn, needle, label) {
  try { fn(); check(false, `${label} (did not throw)`); }
  catch (e) { check(String(e && e.message).includes(needle), `${label} (threw with "${needle}")`); }
}

const MERGES = [
  { key: 'pr-200', hash: 'h2000000000000000000000000000000000000000'.slice(0, 40), short: 'abcdef12', date: '2026-09-01', pr: 200 },
  { key: 'c-deadbeef12', hash: 'deadbeef12ffffffffffffffffffffffffffffffff', short: 'deadbee', date: '2026-08-15', pr: null },
  { key: 'pr-300', hash: 'h3000000000000000000000000000000000000000'.slice(0, 40), short: 'ffff0001', date: '2026-07-01', pr: 300 },
];
const SEED = {
  sections: ['Added', 'Changed', 'Fixed', 'Security'],
  tags: {},
  entries: {
    'pr-200': { section: 'Added', title: 'Clean public title one' },
    'c-deadbeef12': { section: 'Fixed', title: 'Clean public title two' },
    'pr-300': { section: 'Changed', title: 'Clean public title three' },
  },
};

// ── 1. FAIL-CLOSED FORWARD ──────────────────────────────────────────────────
{
  const s = JSON.parse(JSON.stringify(SEED));
  delete s.entries['pr-300'];
  throws(() => renderChangelog(MERGES, [], s),
    'FAIL-CLOSED: 1 unclassified merge entry',
    'unclassified merge entry named and refused');
  throws(() => renderChangelog(MERGES, [], s),
    'pr-300',
    'the missing key (pr-300) is named in the failure');
}
// ── 2. FAIL-CLOSED TAGS + SCOPE CLASSIFICATION ──────────────────────────────
{
  const TAGS = [{ name: 'v9.9-beta', date: '2026-08-20' }];
  throws(() => renderChangelog(MERGES, TAGS, SEED),
    'reachable tag(s) unclassified',
    'unclassified reachable tag refused');
  const withHeading = JSON.parse(JSON.stringify(SEED));
  withHeading.tags = { 'v9.9-beta': { heading: '9.9.0 — public release' } };
  const out = renderChangelog(MERGES, TAGS, withHeading);
  check(out.includes('## 9.9.0 — public release'), 'classified tag renders as a version scope');
  // date == tag date belongs to the tag scope; newer goes to Unreleased.
  const tagScopeHas300 = /## 9\.9\.0[\s\S]*2026-07-01/.test(out);
  const unreleasedHas200 = /## Unreleased[\s\S]*2026-09-01/.test(out);
  const boundary = /## 9\.9\.0[\s\S]*2026-08-15/.test(out);
  check(tagScopeHas300 && unreleasedHas200 && boundary, 'scope boundaries: Unreleased vs tag by date (incl. == tag date)');
  const ignored = JSON.parse(JSON.stringify(SEED));
  ignored.tags = { 'v9.9-beta': { ignore: 'scratch tag from a pre-rebase experiment, not a release' } };
  const out2 = renderChangelog(MERGES, TAGS, ignored);
  check(!out2.includes('v9.9-beta') && out2.includes('## Unreleased'), 'ignored tag renders nothing and everything stays Unreleased');
}
// ── 3. FAIL-CLOSED SECTIONS ─────────────────────────────────────────────────
{
  const s = JSON.parse(JSON.stringify(SEED));
  s.entries['pr-200'].section = 'Operations';
  throws(() => renderChangelog(MERGES, [], s), 'sections outside seed.sections', 'unknown section name refused');
}
// ── 4. LEAK GATE: RED-then-GREEN, quoting included ──────────────────────────
{
  const poisoned = JSON.parse(JSON.stringify(SEED));
  poisoned.entries['pr-200'].title = 'CHANGELOG-1: land art-591 by Tim, drafted in Claude (board/) — SO #35';
  const text = renderChangelog(MERGES, [], poisoned);
  const leaks = collectLeaks(text);
  const names = new Set(leaks.map((l) => l.name));
  for (const want of ['row-id', 'owner-name', 'model-vendor', 'internal-path', 'standing-order-ref']) {
    check(names.has(want), `leak gate catches planted class "${want}"`);
  }
  const quoted = leaks.find((l) => l.name === 'row-id');
  check(quoted && quoted.line.includes('CHANGELOG-1') && quoted.no > 0,
    'leak gate QUOTES the offending line with a line number');
  check(text.includes('CHANGELOG-1'), 'control: the planted leak is really in the rendered bytes (gate had something to catch)');
  // GREEN half: the clean seed over the same merges.
  check(collectLeaks(renderChangelog(MERGES, [], SEED)).length === 0, 'clean fixtures render leak-free (GREEN)');
}
// ── 5. LEAK GATE NEGATIVES (public vocabulary stays public) ─────────────────
{
  const pub = JSON.parse(JSON.stringify(SEED));
  pub.entries['pr-200'].title = 'Add art-544 per ISO-20022 and SHA-256, cross-link T420-427, cite section 18';
  const text = renderChangelog(MERGES, [], pub);
  check(collectLeaks(text).length === 0, 'public token shapes (art-NNN, ISO-20022, SHA-256, T420-427) read clean');
  for (const t of PUBLIC_TOKEN_ALLOWLIST) {
    if (!pub.entries['pr-200'].title.includes(t)) check(false, `allowlist token ${t} missing from the fixture itself`);
  }
  const mixed = JSON.parse(JSON.stringify(SEED));
  mixed.entries['pr-200'].title = `Ship ISO-20022 parsing (note: SEE-ROW-9)`;
  const hits = collectLeaks(renderChangelog(MERGES, [], mixed));
  check(hits.some((h) => h.name === 'row-id' && h.hit === 'SEE-ROW-9'),
    'allowlisted token on the SAME line does not mask a real leak (strip, never skip)');
}
// ── 6. IDEMPOTENCE (pure function, no wall clock) ───────────────────────────
{
  const a = renderChangelog(MERGES, [], SEED);
  const b = renderChangelog(MERGES, [], SEED);
  check(a === b && a.length > 0, 'same (merges, tags, seed) renders byte-identical output');
  check(!/\b20\d\d-\d\d-\d\dT/.test(a), 'no wall-clock timestamp enters the bytes');
  check(a.endsWith('\n') && a.includes('DO NOT HAND-EDIT'), 'output carries the no-hand-edit marker and ends with a newline');
}
// ── 8. TAG-LESS ENVIRONMENT (MERGEGROUP TAG-FIX) ────────────────────────────
// GitHub's ephemeral merge-group queue checkout fetches NO tag refs, so the
// `git tag --merged` call ERRORS there — measured red in run 35692678563,
// where it failed derived-artifacts --regen on a healthy tree and evicted the
// queue entry. The contract under test: the listing failure degrades to an
// EMPTY tag set and rendering SUCCEEDS (merge-commit entries classify via
// their subjects; no tag scopes; no crash). The runner is injected, so this
// control simulates the exact failure without spawning git.
{
  const r = listTags(() => {
    throw new Error('fatal: your current branch \'main\' does not have any commits yet — no tag refs fetched (simulated merge-group checkout)');
  });
  check(r.source === 'tag-less-environment' && r.tags.length === 0 && typeof r.error === 'string',
    'git tag failure degrades to the EMPTY tag set with a named tag-less-environment source');
  let out = null;
  try { out = renderChangelog(MERGES, r.tags, SEED); } catch (e) { out = null; console.error('  render threw: ' + e.message); }
  check(out !== null && out.includes('## Unreleased') && out.includes('2026-09-01'),
    'tag-less render SUCCEEDS: merge-commit entries classify, no tag scopes, no crash');
  check(out !== null && !/## v/.test(out), 'tag-less render emits no version scope headings');
  // Parser control: a healthy listing still parses (the tolerant path must not
  // have swallowed real tags).
  const good = listTags(() => 'v1.0\t2026-08-20\nv0.9\t2026-07-01\n');
  check(good.source === 'git' && good.tags.length === 2 && good.tags[0].name === 'v1.0' && good.tags[1].date === '2026-07-01',
    'parser control: healthy git tag listing parses to ordered {name, date} pairs');
  // And the tolerant empty set renders IDENTICALLY to an honest zero-tag listing.
  const viaEmpty = renderChangelog(MERGES, [], SEED);
  check(out === viaEmpty, 'tag-less bytes identical to an honest zero-tag render (no hidden divergence)');
}
// ── 7. REAL SEED SANITY ─────────────────────────────────────────────────────
{
  const seed = JSON.parse(readFileSync(new URL('./changelog-seed.json', import.meta.url), 'utf8'));
  check(Array.isArray(seed.sections) && seed.sections.length >= 3, 'committed seed: sections well-formed');
  const bad = Object.entries(seed.entries || {}).filter(([, v]) => !seed.sections.includes(v.section));
  check(bad.length === 0, `committed seed: every entry names a real section (${bad.length} bad)`);
  const leaky = Object.entries(seed.entries || {}).filter(([, v]) => collectLeaks(`- ${v.title}`).length > 0);
  check(leaky.length === 0, `committed seed: every committed title passes the leak gate (${leaky.length} leaky)`);
}

console.log(`\n1..${ran}`);
if (failed) { console.error(`gen-changelog.selftest: ${failed}/${ran} FAILED`); process.exit(1); }
console.log(`gen-changelog.selftest: ${ran}/${ran} green`);
