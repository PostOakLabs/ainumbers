#!/usr/bin/env node
// check-ai-price-freshness.mjs — art-704 AI price snapshot freshness gate (AI-PRICE-REFRESH-1).
//
// WHY: the AI-spend node's page (chaingraph/art-704-ai-token-spend.html) inlines the dated
// default price snapshot — the `const AMBIG_TABLE=` block — and every entry carries its own
// `verified_on` stamp, exactly the check-deadline-freshness.mjs pattern (data/reg-deadlines.json
// → SI-DEADLINE-FRESH-1). Prices decay on providers' own schedules (Google's page already lists
// its 2027-01-01 scheduled change), and a stale snapshot prices silently wrong: nothing asserted
// recency until this gate. Staleness is derived FROM the entries' own `verified_on` field —
// never a hand-maintained "last checked" ledger — and reds out past a threshold. Per SO #0
// (SURVIVES-THE-MAINTAINER, "no recurring human duty may ship"): the gate REPORTS staleness; the
// weekly automated capture step (ai-price-capture.mjs in PostOakLabs/ainumbers-internal,
// AI-PRICE-REFRESH-1) is what actually refreshes the snapshot. Zero-dependency, node: builtins
// only (site repo is zero-dep).
//
// The snapshot's home is the page — NOT the manifest: manifests/*.manifest.json are regen-owned
// derived bytes (derived-artifacts.mjs COVERED, via scripts/generate-node-manifest.mjs), and the
// post-merge regen (9fd3e4c5, 2026-10-05T04:31Z) normalized art-704's input_example to the F1
// fixture example. The page is hand-authored and carries the full snapshot, so the page is what
// this gate (and the capture step) read.
//
// Usage:
//   node scripts/check-ai-price-freshness.mjs              strict (the eventual CI mode): exit 1 on any stale entry
//   node scripts/check-ai-price-freshness.mjs --summary     advisory (current preflight wiring): counts only, exit 0
//   node scripts/check-ai-price-freshness.mjs --self-test   RED/GREEN fixture proof, exit 0 all-pass else 1
//
// ADVISORY FIRST: preflight wires the --summary form (counts, never a red) so the gate can ship
// before the weekly capture step has proven itself; flipping preflight to the strict default is
// a deliberate follow-up row, the way freshness gates on this repo have always ramped.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDenominatorOrExit } from './denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE_PATH = resolve(REPO, 'chaingraph/art-704-ai-token-spend.html');
const PAGE_MARKER = 'const AMBIG_TABLE=';

const SUMMARY = process.argv.includes('--summary');
const SELF_TEST = process.argv.includes('--self-test');

// The weekly capture step fires every 7 days; 30 days = four missed weeks before the gate says
// anything is wrong in strict mode. Named constant — never a magic number (SI-DEADLINE-FRESH-1
// precedent: the threshold is the row's contract, not an implementation detail).
const STALE_THRESHOLD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── parse the page's snapshot block (pure functions, so --self-test can drive them) ─────────
export function parseSnapshotPage(html) {
  const at = html.indexOf(PAGE_MARKER);
  if (at === -1) return { error: `no "${PAGE_MARKER}" block in the page (was the page rewritten?)` };
  const end = html.indexOf('};', at);
  if (end === -1) return { error: 'AMBIG_TABLE block found but its object literal is unterminated (expected `};`)' };
  try {
    const snapshot = JSON.parse(html.slice(at + PAGE_MARKER.length, end + 1));
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.models)) {
      return { error: 'AMBIG_TABLE block parsed but carries no models[] array' };
    }
    return { snapshot };
  } catch (err) {
    return { error: `AMBIG_TABLE block is not parseable JSON: ${err.message}` };
  }
}

// Staleness FROM the entry's own verified_on, never a ledger. Returns one row per problem.
export function collectStale(models, now = new Date(), thresholdDays = STALE_THRESHOLD_DAYS) {
  const stale = [];
  for (const entry of models) {
    const verifiedOn = entry.verified_on;
    if (!verifiedOn) {
      stale.push({ model: `${entry.provider || '?'}/${entry.model || '?'}`, verified_on: verifiedOn ?? '(missing)', age: null, reason: 'no verified_on field' });
      continue;
    }
    const verifiedDate = new Date(`${verifiedOn}T00:00:00Z`);
    if (Number.isNaN(verifiedDate.getTime())) {
      stale.push({ model: `${entry.provider || '?'}/${entry.model || '?'}`, verified_on: verifiedOn, age: null, reason: 'unparseable verified_on date' });
      continue;
    }
    const ageDays = Math.floor((now.getTime() - verifiedDate.getTime()) / MS_PER_DAY);
    if (ageDays > thresholdDays) {
      stale.push({ model: `${entry.provider}/${entry.model}`, verified_on: verifiedOn, age: ageDays, reason: null });
    }
  }
  return stale;
}

// ── RED/GREEN self-test (SO #40b: prove RED before GREEN) — fixtures, no network, no files ──
function selfTest() {
  const now = new Date('2026-10-05T12:00:00Z');
  const page = (verifiedOn) => `<html><script>const AMBIG_TABLE={"snapshot_verified_on":"${verifiedOn}","currency":"USD","unit":"usd_micros_per_million_tokens","models":[{"provider":"anthropic","model":"fixture-1","tier":"standard","input":1,"verified_on":"${verifiedOn}"}]};</script></html>`;
  const failures = [];
  const check = (cond, label) => { if (cond) console.log(`  PASS: ${label}`); else { console.log(`  FAIL: ${label}`); failures.push(label); } };

  // RED: a 40-day-old entry is stale, and a page with ONLY stale entries fails strict.
  const red = parseSnapshotPage(page('2026-08-26'));
  check(!red.error, 'RED fixture page parses');
  const redStale = collectStale(red.snapshot.models, now);
  check(redStale.length === 1 && redStale[0].age === 40, `RED: 40-day-old entry flagged stale at age 40 (got ${JSON.stringify(redStale)})`);
  check(redStale.length > 0, 'RED: strict mode would exit 1 on this page');

  // GREEN: a 1-day-old entry is fresh; the 30-day edge itself is NOT stale (> 30 is).
  const green = parseSnapshotPage(page('2026-10-04'));
  check(!green.error && collectStale(green.snapshot.models, now).length === 0, 'GREEN: 1-day-old entry is fresh');
  const edge = parseSnapshotPage(page('2026-09-05'));
  check(!edge.error && collectStale(edge.snapshot.models, now).length === 0, 'GREEN: entry at exactly the 30-day edge is not stale (strict reds only past 30)');

  // Broken-shape fixtures fail closed (a gate that cannot read the page must not pass).
  const noMarker = parseSnapshotPage('<html>rewritten</html>');
  check(!!noMarker.error, 'broken shape: missing marker is an error, never a silent pass');
  const badJson = parseSnapshotPage('<script>const AMBIG_TABLE={oops};</script>');
  check(!!badJson.error, 'broken shape: unparseable block is an error, never a silent pass');
  const noModels = parseSnapshotPage('<script>const AMBIG_TABLE={"snapshot_verified_on":"2026-10-01"};</script>');
  check(!!noModels.error, 'broken shape: block without models[] is an error, never a silent pass');
  check(collectStale([{ provider: 'x', model: 'y' }], now).length === 1, 'broken shape: entry without verified_on counts stale');

  if (failures.length) { console.error(`✗ check-ai-price-freshness self-test FAILED (${failures.length} assertion(s))`); process.exit(1); }
  console.log('✓ check-ai-price-freshness self-test clean — RED/GREEN/broken-shape fixtures all behave');
  process.exit(0);
}

if (SELF_TEST) selfTest();

// ── the real gate ────────────────────────────────────────────────────────────────────────────
let html;
try {
  html = readFileSync(PAGE_PATH, 'utf8');
} catch (err) {
  console.error(`✗ ai-price-freshness gate FAILED — ${PAGE_PATH} unreadable: ${err.message}`);
  process.exit(1);
}
const parsed = parseSnapshotPage(html);
if (parsed.error) {
  console.error(`✗ ai-price-freshness gate FAILED — ${parsed.error}`);
  process.exit(1);
}
const models = parsed.snapshot.models;

// ── DENOMINATOR SENTINEL (DENOMINATOR-SENTINEL-1 / F-05, the sibling gates' control): a snapshot
// with zero entries would otherwise close vacuously green — every entry fresh, nothing checked.
assertDenominatorOrExit(models.length, 1, {
  label: 'check-ai-price-freshness',
  unit: 'dated snapshot model entr(y|ies)',
  scope: 'chaingraph/art-704-ai-token-spend.html → const AMBIG_TABLE= → .models[]',
  remedy: 'the snapshot models[] array was emptied or the page rewritten — restore it: git checkout origin/main -- chaingraph/art-704-ai-token-spend.html',
});

const stale = collectStale(models);
const newest = models.map((m) => m.verified_on).filter(Boolean).sort().pop() ?? '(none)';

if (SUMMARY) {
  console.log(`ai-price snapshot freshness — ${models.length} model entr${models.length === 1 ? 'y' : 'ies'}, ${stale.length} stale, newest verified_on ${newest} (threshold ${STALE_THRESHOLD_DAYS}d; advisory --summary mode, exit 0)`);
  process.exit(0);
}

if (stale.length) {
  console.error(`✗ ai-price-freshness gate FAILED — ${stale.length} of ${models.length} entries in the art-704 snapshot past the ${STALE_THRESHOLD_DAYS}-day freshness threshold:`);
  for (const s of stale) {
    if (s.reason) console.error(`  • ${s.model} — ${s.reason} (verified_on="${s.verified_on}")`);
    else console.error(`  • ${s.model} — last verified ${s.verified_on}, ${s.age} days ago (threshold ${STALE_THRESHOLD_DAYS})`);
  }
  console.error('\nFix: the weekly capture step (ai-price-capture.mjs, PostOakLabs/ainumbers-internal) refreshes this snapshot by PR; run it (or land its PR) — never hand-type prices.');
  process.exit(1);
}
console.log(`✓ ai-price-freshness gate clean — ${models.length} entries, all verified within ${STALE_THRESHOLD_DAYS} days (newest ${newest}); snapshot_verified_on ${parsed.snapshot.snapshot_verified_on}.`);
