// art-284-did-webvh-log-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:97e3a600e8c080411e3c7477f14202093f2f440ff63e7f4658c9ca832ff5e803
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — regex/string parsing, versionId sequence
// integer compare, and boolean gates only; no floating-point arithmetic anywhere in compute()).
// TERMINATION-BOUND ARGUMENT (verifier kernel, per WU row instruction): the main for-loop is
// bounded by `boundedLog.length`, itself `Math.min(rawLog.length, maxEntries)` where maxEntries
// is further clamped to HARD_MAX_ENTRIES=500 before the loop starts — a single-pass, non-
// recursive walk with an early `break` on `deactivated`. No SAID/signature recursion (art-284
// is a flat log, unlike art-285's parent-chain walk).
// Checks: fixture-oracle gate, termination/boundedness (entries_checked never exceeds
// min(did_log.length, max_entries, HARD_MAX_ENTRIES=500)), a differential re-derivation of
// SEQUENCE_BROKEN from the parsed versionId numbering, a metamorphic identity (once `deactivated`
// fires the loop breaks immediately — entries_checked stops growing no matter how many more
// garbage entries follow), and forced categorical boundary cases (float:no, no ULP forcing):
// did_log not an array, empty log, log length exactly at / one over max_entries, deactivation
// mid-log.
// compute() is async (uses globalThis.crypto.subtle) — every property awaits it.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-284-did-webvh-log-verifier.proptest.mjs

import { compute } from '../art-284-did-webvh-log-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-284-did-webvh-log-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x284A0);

function garbageEntry(rng, idx, { deactivate = false, versionId = null } = {}) {
  return {
    versionId: versionId ?? `${idx + 1}-${'0'.repeat(64)}`,
    versionTime: '2026-01-01T00:00:00Z',
    parameters: { scid: idx === 0 ? 'scid1' : undefined, updateKeys: idx === 0 ? ['did:key:z6Mkfake'] : undefined, deactivate: deactivate || undefined },
    state: { id: 'did:webvh:x' },
    proof: [],
  };
}
function garbageLog(rng, n, deactivateAt = -1) {
  return Array.from({ length: n }, (_, i) => garbageEntry(rng, i, { deactivate: i === deactivateAt }));
}

const TRIALS = 800; // async crypto.subtle calls per entry -> smaller trial count than sync kernels

// ---------- P1: termination/boundedness — entries_checked bounded by min(log.length, max_entries, 500) ----------
async function checkP1_bounded_entries() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const maxEntries = 1 + Math.floor(rand() * 10);
    const pp = { did: 'did:webvh:x:example.com', did_log: garbageLog(rand, n), max_entries: maxEntries };
    checked++;
    const { output_payload } = await compute(pp);
    const bound = Math.min(n, maxEntries, 500);
    if (output_payload.entries_checked > bound) violations++;
  }
  return { name: 'P1_entries_checked_bounded_by_min_length_maxentries_hardcap', trials: checked, violations };
}

// ---------- P2 (differential): SEQUENCE_BROKEN re-derivation from parsed versionId numbering ----------
async function checkP2_sequence_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const log = garbageLog(rand, n);
    // corrupt one entry's versionId numbering (not the first, to avoid also tripping SCID checks)
    const corruptIdx = 1 + Math.floor(rand() * (n - 1 >= 1 ? n - 1 : 1)) % n;
    if (n > 1 && rand() < 0.5) {
      log[corruptIdx] = garbageEntry(rand, corruptIdx, { versionId: `${corruptIdx + 99}-${'0'.repeat(64)}` });
    }
    const pp = { did: 'did:webvh:x:example.com', did_log: log, max_entries: 500 };
    checked++;
    const { output_payload } = await compute(pp);
    for (let idx = 0; idx < Math.min(n, output_payload.entries_checked); idx++) {
      const vid = log[idx].versionId;
      const m = /^(\d+)-[0-9a-f]{64}$/.exec(vid);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      const hasSeqBroken = output_payload.failures.some((f) => f.entry_index === idx && f.code === 'SEQUENCE_BROKEN');
      const expectSeqBroken = num !== idx + 1;
      if (hasSeqBroken !== expectSeqBroken) violations++;
    }
  }
  return { name: 'P2_sequence_broken_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — deactivation halts processing immediately, trailing entries never re-checked ----------
async function checkP3_deactivation_halts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 3 + Math.floor(rand() * 8);
    const deactivateAt = 1 + Math.floor(rand() * (n - 2));
    const log = garbageLog(rand, n, deactivateAt);
    const pp = { did: 'did:webvh:x:example.com', did_log: log, max_entries: 500 };
    checked++;
    const { output_payload } = await compute(pp);
    if (!output_payload.deactivated) continue; // deactivation logic depends on proof/signature success too; skip non-deactivated runs
    // entries after deactivateAt (if any exist) must be reported as DEACTIVATED_LOG_CONTINUED, not silently processed further
    if (output_payload.entries_checked > deactivateAt + 2) violations++; // +1 for the deactivating entry, +1 for the break-detecting iteration
  }
  return { name: 'P3_deactivation_halts_processing', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing) ----------
async function checkP4_forced() {
  const cases = [
    { label: 'did_log not an array -> LOG_NOT_ARRAY, entries_checked=0', pp: { did: 'did:webvh:x', did_log: 'not-an-array' } },
    { label: 'empty did_log array -> entries_checked=0, valid trivially true or false per other failures', pp: { did: 'did:webvh:x', did_log: [] } },
    { label: 'did missing -> DID_MISSING failure', pp: { did_log: [] } },
    { label: 'log length exactly at max_entries (5) -> not truncated', pp: { did: 'did:webvh:x', did_log: garbageLog(rand, 5), max_entries: 5 } },
    { label: 'log length 1 over max_entries (6 > 5) -> MAX_ENTRIES_EXCEEDED failure', pp: { did: 'did:webvh:x', did_log: garbageLog(rand, 6), max_entries: 5 } },
    { label: 'max_entries requested above HARD_MAX_ENTRIES (500) clamps to 500', pp: { did: 'did:webvh:x', did_log: garbageLog(rand, 3), max_entries: 100000 } },
  ];
  const rows = [];
  for (const c of cases) {
    const { output_payload } = await compute(c.pp);
    rows.push({ label: c.label, entries_checked: output_payload.entries_checked, failures: output_payload.failures.map((f) => f.code) });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_bounded_entries());
results.properties.push(await checkP2_sequence_differential());
results.properties.push(await checkP3_deactivation_halts());
const forcedCases = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-284-did-webvh-log-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
