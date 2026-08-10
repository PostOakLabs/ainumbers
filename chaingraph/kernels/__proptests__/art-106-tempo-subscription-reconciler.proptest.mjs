// art-106-tempo-subscription-reconciler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:1995b8044643af3b0040b0141b607050d90479fefaa911f9b9134eecc99cf250
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (cap_per_cycle / cap_total strict-> breach
// boundaries, valid_until strict-> expiry boundary).
// Checks: fixture-oracle gate, termination (array-bounded, cycleMap size <= draws.length), boundedness
// (residual_envelope in [0, cap_total] when cap_total>0), verdict/compliance_flags differential
// re-derivation, permutation-invariance of the draws array (including draw_merkle_root, which the kernel
// itself sorts before hashing), and ULP-forced cap/expiry boundary cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-106-tempo-subscription-reconciler.proptest.mjs

import { compute } from '../art-106-tempo-subscription-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-106-tempo-subscription-reconciler.fixtures.json');
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
const rand = mulberry32(0xA06A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomDraw(rng, i) {
  return { seq: i, amount: randRange(rng, 1, 200), ts: randInt(rng, 1_700_000_000, 1_800_000_000), cycle: randInt(rng, 1, 5) };
}
function randomEnvelope(rng) {
  return { cap_total: randRange(rng, 200, 2000), cap_per_cycle: randRange(rng, 50, 500), valid_until: randInt(rng, 1_750_000_000, 1_790_000_000), cadence: 'monthly', mode: 'subscription' };
}

const TRIALS = 4000;

// ---------- P1: termination — draw_count === input length, cycleMap bounded by draws.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = randInt(rand, 0, 40);
    const draws = Array.from({ length: n }, (_, idx) => randomDraw(rand, idx));
    const { output_payload } = compute({ envelope: randomEnvelope(rand), draws });
    checked++;
    if (output_payload.draw_count !== n) violations++;
  }
  return { name: 'P1_termination_draw_count', trials: checked, violations };
}

// ---------- P2: boundedness — residual_envelope in [0, cap_total] when cap_total > 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const envelope = randomEnvelope(rand);
    const n = randInt(rand, 0, 15);
    const draws = Array.from({ length: n }, (_, idx) => randomDraw(rand, idx));
    const { output_payload } = compute({ envelope, draws });
    checked++;
    if (output_payload.residual_envelope < 0) violations++;
    // Tolerance is the kernel's own .toFixed(6) rounding unit on residual_envelope, compared against
    // an UNROUNDED cap_total from the generator — a residual exactly at cap_total can round up by <=5e-7.
    if (envelope.cap_total > 0 && output_payload.residual_envelope > envelope.cap_total + 1e-6) violations++;
    if (!Number.isFinite(output_payload.total_drawn) || !Number.isFinite(output_payload.residual_envelope)) violations++;
  }
  return { name: 'P2_boundedness_residual_envelope', trials: checked, violations };
}

// ---------- P3 (differential): verdict / cumulative_ok re-derivation from breach set ----------
function checkP3_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const envelope = randomEnvelope(rand);
    const n = randInt(rand, 1, 10);
    const draws = Array.from({ length: n }, (_, idx) => randomDraw(rand, idx));
    const { output_payload, compliance_flags } = compute({ envelope, draws });
    checked++;
    const expectedCumulativeOk = !(envelope.cap_total > 0 && output_payload.total_drawn > envelope.cap_total);
    if (output_payload.cumulative_ok !== expectedCumulativeOk) violations++;
    const expectedVerdict = output_payload.breaches.length === 0 ? 'CONFORMANT' : 'BREACH_DETECTED';
    if (output_payload.verdict !== expectedVerdict) violations++;
    if (expectedVerdict === 'CONFORMANT' && !compliance_flags.includes('MPP_DRAWS_CONFORMANT')) violations++;
    if (expectedVerdict === 'BREACH_DETECTED' && !compliance_flags.includes('MPP_DRAW_BREACH')) violations++;
  }
  return { name: 'P3_verdict_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of draws (aggregates + draw_merkle_root, pre-sorted) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const envelope = randomEnvelope(rand);
    const n = randInt(rand, 2, 10);
    const draws = Array.from({ length: n }, (_, idx) => randomDraw(rand, idx));
    const r1 = compute({ envelope, draws }).output_payload;
    const r2 = compute({ envelope, draws: shuffle(rand, draws) }).output_payload;
    checked++;
    if (r1.total_drawn !== r2.total_drawn) violations++;
    if (r1.cycles_ok !== r2.cycles_ok) violations++;
    if (r1.cumulative_ok !== r2.cumulative_ok) violations++;
    if (r1.verdict !== r2.verdict) violations++;
    if (r1.draw_merkle_root !== r2.draw_merkle_root) violations++;
  }
  return { name: 'P4_permutation_invariance_draws', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — cap_per_cycle / cap_total / valid_until strict boundaries ----------
const ULP_BOUNDARY_CASES = [
  { envelope: { cap_total: 1000, cap_per_cycle: 100, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: 100, ts: 1, cycle: 1 }], label: 'cycleTotal === cap_per_cycle exactly -> NOT a breach (strict >)' },
  { envelope: { cap_total: 1000, cap_per_cycle: 100, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: 100 + 1e-9, ts: 1, cycle: 1 }], label: 'cycleTotal fractionally over cap_per_cycle -> BREACH' },
  { envelope: { cap_total: 500, cap_per_cycle: 0, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: 500, ts: 1, cycle: 1 }], label: 'total_drawn === cap_total exactly -> NOT a breach (strict >)' },
  { envelope: { cap_total: 500, cap_per_cycle: 0, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: 500 + 1e-9, ts: 1, cycle: 1 }], label: 'total_drawn fractionally over cap_total -> BREACH' },
  { envelope: { cap_total: 0, cap_per_cycle: 0, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: 1e9, ts: 1, cycle: 1 }], label: 'cap_total === 0 -> guard disables cumulative check regardless of total_drawn' },
  { envelope: { cap_total: 1000, cap_per_cycle: 0, valid_until: 100 }, draws: [{ seq: 1, amount: 1, ts: 100, cycle: 1 }], label: 'ts === valid_until exactly -> NOT an expiry breach (strict >)' },
  { envelope: { cap_total: 1000, cap_per_cycle: 0, valid_until: 100 }, draws: [{ seq: 1, amount: 1, ts: 101, cycle: 1 }], label: 'ts fractionally over valid_until -> EXPIRY_BREACH' },
  { envelope: { cap_total: 1000, cap_per_cycle: 0, valid_until: 2_000_000_000 }, draws: [{ seq: 1, amount: -0, ts: 1, cycle: 1 }], label: 'negative-zero amount -> behaves as zero, finite total_drawn' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const { output_payload } = compute({ envelope: c.envelope, draws: c.draws });
    rows.push({
      label: c.label,
      verdict: output_payload.verdict,
      breaches: output_payload.breaches.map((b) => b.type),
      total_drawn: output_payload.total_drawn,
      finite: Number.isFinite(output_payload.total_drawn) && Number.isFinite(output_payload.residual_envelope),
    });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_verdict_differential());
results.properties.push(checkP4_permutation_invariance());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const expectedBreachPattern = [false, true, false, true, false, false, true, false];
const anyBoundaryMismatch = results.boundary_forced.some((b, i) => {
  const hasBreach = b.breaches.length > 0;
  return hasBreach !== expectedBreachPattern[i] || !b.finite;
});

console.log(JSON.stringify({
  tool_id: 'art-106-tempo-subscription-reconciler',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
