// art-11-vop-batch-match-rate-analyser.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:dc6cecdac12b5053afc065404fa713ef895d66b7721806ce245957a45a7011c6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (match_threshold / close_match_threshold exact
// equality boundaries, using the kernel's own exact-match/empty-string special cases rather than
// re-implementing Jaro-Winkler independently).
// Checks: fixture-oracle gate, termination (array-bounded, accounting identity total = match+close+no),
// boundedness of match_rate_pct in [0,100], compliance_flags differential re-derivation, permutation-
// invariance of the payee array, and ULP-forced threshold boundary cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-11-vop-batch-match-rate-analyser.proptest.mjs

import { compute } from '../art-11-vop-batch-match-rate-analyser.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-11-vop-batch-match-rate-analyser.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
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
const rand = mulberry32(0xA11A1);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NAME_PARTS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka', 'Soylent', 'Massive Dynamic'];
const SUFFIXES = ['Corp', 'Ltd', 'GmbH', 'Inc', 'LLC', ''];
function randomName(rng) {
  return `${pick(rng, NAME_PARTS)} ${pick(rng, SUFFIXES)}`.trim();
}
function randomPayee(rng) {
  const base = randomName(rng);
  const drift = rng() < 0.5;
  return { account_name: base, reference_name: drift ? randomName(rng) : base };
}

const TRIALS = 4000;

// ---------- P1: termination / accounting identity — total_records === payees.length, match+close+no === total ----------
function checkP1_accounting_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 30);
    const payees = Array.from({ length: n }, () => randomPayee(rand));
    const { output_payload } = compute({ payees });
    checked++;
    if (output_payload.total_records !== n) violations++;
    if (output_payload.match + output_payload.close_match + output_payload.no_match !== output_payload.total_records) violations++;
  }
  return { name: 'P1_termination_accounting_identity', trials: checked, violations };
}

// ---------- P2: boundedness — match_rate_pct in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 20);
    const payees = Array.from({ length: n }, () => randomPayee(rand));
    const { output_payload } = compute({ payees });
    checked++;
    if (output_payload.match_rate_pct < 0 || output_payload.match_rate_pct > 100) violations++;
    if (!Number.isFinite(output_payload.match_rate_pct)) violations++;
  }
  return { name: 'P2_boundedness_match_rate_0_100', trials: checked, violations };
}

// ---------- P3 (differential): compliance_flags re-derived from match/no_match ratios ----------
function checkP3_flags_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 20);
    const payees = Array.from({ length: n }, () => randomPayee(rand));
    const { output_payload, compliance_flags } = compute({ payees });
    checked++;
    const total = output_payload.total_records;
    let expected;
    if (total === 0) expected = 'VOP_NO_RECORDS';
    else if (output_payload.match / total >= 0.85) expected = 'VOP_HIGH_MATCH_RATE';
    else if (output_payload.no_match / total >= 0.3) expected = 'VOP_HIGH_NO_MATCH_RATE';
    else expected = 'VOP_ACCEPTABLE_MATCH_RATE';
    if (!compliance_flags.includes(expected) || compliance_flags.length !== 1) violations++;
  }
  return { name: 'P3_compliance_flags_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — identical account_name/reference_name pairs always MATCH; permutation-invariance ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const name = randomName(rand);
    const { output_payload } = compute({ payees: [{ account_name: name, reference_name: name }] });
    checked++;
    if (output_payload.match !== 1) violations++;
  }
  for (let i = 0; i < 1500; i++) {
    const n = randInt(rand, 2, 12);
    const payees = Array.from({ length: n }, () => randomPayee(rand));
    const r1 = compute({ payees }).output_payload;
    const r2 = compute({ payees: shuffle(rand, payees) }).output_payload;
    checked++;
    if (r1.total_records !== r2.total_records || r1.match !== r2.match || r1.close_match !== r2.close_match || r1.no_match !== r2.no_match || r1.match_rate_pct !== r2.match_rate_pct) violations++;
  }
  return { name: 'P4_metamorphic_exact_match_and_permutation_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — match_threshold / close_match_threshold exact-equality boundaries ----------
// Uses the kernel's own deterministic special cases (na===nb -> sim=1.0 exactly; empty/empty -> sim=1.0)
// rather than re-deriving Jaro-Winkler, so the forced boundary is exact, not approximated.
function checkP5_forced() {
  const rows = [];
  const IDENTICAL = { account_name: 'Acme Corp', reference_name: 'Acme Corp' };
  const EMPTY = { account_name: '', reference_name: '' };
  const DISJOINT = { account_name: 'Zzzzzzz Qqqqqqq', reference_name: '1111111 2222222' };

  let r = compute({ payees: [IDENTICAL], match_threshold: 1.0 });
  rows.push({ label: 'sim===1.0, match_threshold===1.0 exactly (>=) -> MATCH', match: r.output_payload.match, ok: r.output_payload.match === 1 });

  r = compute({ payees: [IDENTICAL], match_threshold: 1.0000000001 });
  rows.push({ label: 'sim===1.0, match_threshold fractionally above 1.0 -> NOT MATCH (falls to close/no)', match: r.output_payload.match, ok: r.output_payload.match === 0 });

  r = compute({ payees: [EMPTY] });
  rows.push({ label: 'empty/empty strings -> na===nb special case, sim=1.0 exactly -> MATCH', match: r.output_payload.match, ok: r.output_payload.match === 1 });

  r = compute({ payees: [DISJOINT], match_threshold: 0, close_match_threshold: 0 });
  rows.push({ label: 'match_threshold===0 exactly -> sim>=0 always true -> everything MATCH, no_match=0', no_match: r.output_payload.no_match, ok: r.output_payload.no_match === 0 });

  r = compute({ payees: [DISJOINT], match_threshold: -0, close_match_threshold: -0 });
  rows.push({ label: 'negative-zero thresholds behave as zero -> no_match=0', no_match: r.output_payload.no_match, ok: r.output_payload.no_match === 0 });

  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_accounting_identity());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_flags_differential());
results.properties.push(checkP4_metamorphic());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.ok);

console.log(JSON.stringify({
  tool_id: 'art-11-vop-batch-match-rate-analyser',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
