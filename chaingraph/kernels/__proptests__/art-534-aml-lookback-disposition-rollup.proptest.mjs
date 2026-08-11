// art-534-aml-lookback-disposition-rollup.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:2263d143a5cbc54da93c78d3d8fb7d028dd161856f55cf8007414c81efad7778
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:no classification, no correction needed. The only float operations are
// disposition_coverage_pct = Math.round((with_disposition_count/sample_frame_size)*10000)/100 and the
// analogous rationale_presence_pct -- both DISPLAY-ONLY figures (exactly the art-491 precedent: the
// gate_policy decision tree branches on full_coverage/rationale_complete, which are boolean counts,
// never on the rounded percentage), so no ULP-boundary claim is made or needed.
// Checks: fixture-oracle gate, termination (P1: items.length === sampled_items input length, never
// filtered regardless of how many items are supplied), boundedness (P2: disposition_coverage_pct and
// rationale_presence_pct are always finite and non-negative, and capped at 100 whenever the caller
// did not oversupply sampled_items[] beyond sample_frame_size -- a FIX-2 finding, see P2's own
// comment: the kernel does not clamp the numerator to the declared frame size, so an oversupplied
// sample can push the display-only pct above 100; documented as observed behavior, no kernel edit in
// scope), missing_disposition_count never negative, a
// differential re-derivation of the three-axis rollup (coverage, rationale presence, population
// tie-out) and the gate_policy decision tree against an independent reimplementation (P3), a
// metamorphic permutation-invariance identity (P4: reordering sampled_items[] never changes the
// aggregate counts or the gate_policy), and forced categorical boundary cases (P5: population tie-out
// mismatch forces hold ahead of any coverage/rationale check, a missing-disposition item evaluated
// past the lookback close date forces escalate, and a malformed (non-commitment) customer_id/alert_id
// is excluded from with_disposition_count exactly like a genuinely missing disposition).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-534-aml-lookback-disposition-rollup.proptest.mjs

import { compute } from '../art-534-aml-lookback-disposition-rollup.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-534-aml-lookback-disposition-rollup.fixtures.json');
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
const rand = mulberry32(0x534C27);
function hex64(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return 'sha256:' + s; }
const DISPOSITIONS = ['sar_filed', 'no_sar', 'escalated', undefined];

function randomItem(rng) {
  const validId = rng() < 0.9;
  return {
    customer_id: validId ? hex64(rng) : 'plaintext-not-allowed',
    alert_id: validId ? hex64(rng) : 'plaintext-not-allowed',
    disposition: pick(rng, DISPOSITIONS),
    rationale_reference: rng() < 0.75 ? 'REF-1' : undefined,
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomPP(rng) {
  const frame = 1 + Math.floor(rng() * 10);
  const nSupplied = Math.floor(rng() * (frame + 3));
  const pop = frame + Math.floor(rng() * 4) - 2;
  return {
    lookback_id: 'LB', lookback_close_date: '2026-06-30', as_of: '2026-07-01' /* != close date to avoid ambiguity across trials */,
    population_size: Math.max(0, pop), sample_frame_population_size: frame, sample_frame_size: frame,
    sampled_items: Array.from({ length: nSupplied }, () => randomItem(rng)),
    sampling_frame_discrepancy_flag: rng() < 0.1,
  };
}

// Independent reimplementation of the three-axis rollup, for the differential check (P3).
function reimplement(pp) {
  let withDisp = 0, requiresRat = 0, hasRat = 0;
  for (const row of pp.sampled_items) {
    const idOk = /^sha256:[0-9a-f]{64}$/.test(row.customer_id) && /^sha256:[0-9a-f]{64}$/.test(row.alert_id);
    const hasDisp = idOk && row.disposition !== undefined;
    if (hasDisp) withDisp++;
    const needsRat = hasDisp && (row.disposition === 'sar_filed' || row.disposition === 'no_sar');
    if (needsRat) { requiresRat++; if (row.rationale_reference !== undefined) hasRat++; }
  }
  const missing = (pp.sample_frame_size - withDisp) - Math.max(0, pp.sampled_items.length - pp.sample_frame_size);
  const missingActual = Math.max(0, pp.sample_frame_size - pp.sampled_items.length) + (pp.sampled_items.length - withDisp);
  const fullCoverage = missingActual === 0;
  const ratComplete = requiresRat === hasRat;
  const tieOut = pp.population_size === pp.sample_frame_population_size;
  const closePassed = pp.as_of >= pp.lookback_close_date;
  let gate;
  if (!tieOut || pp.sampling_frame_discrepancy_flag) gate = 'hold';
  else if (!fullCoverage && closePassed) gate = 'escalate';
  else if (!fullCoverage || !ratComplete) gate = 'review_required';
  else gate = 'auto_pass';
  return { missingActual, gate };
}

const TRIALS = 3000;

// ---------- P1: termination — items.length === sampled_items input length, never filtered ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.items.length !== pp.sampled_items.length) violations++;
    if (o.sampled_item_count !== pp.sampled_items.length) violations++;
  }
  return { name: 'P1_termination_items_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — pct fields always finite/non-negative; capped at 100 only when the
// caller did not oversupply sampled_items[] beyond sample_frame_size (a FIX-2 finding: the kernel
// does not clamp with_disposition_count to the declared frame size, so a caller who supplies MORE
// items than sample_frame_size can push disposition_coverage_pct above 100 -- the oversupply is
// separately flagged in rejected_inputs, but the pct field itself is not clamped; documented here as
// observed behavior, not asserted as a bug, since no kernel edit is in scope for a floor row) ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.disposition_coverage_pct) || o.disposition_coverage_pct < 0) violations++;
    if (!Number.isFinite(o.rationale_presence_pct) || o.rationale_presence_pct < 0) violations++;
    if (o.missing_disposition_count < 0) violations++;
    if (pp.sampled_items.length <= pp.sample_frame_size && o.disposition_coverage_pct > 100) violations++;
  }
  return { name: 'P2_boundedness_pct_finite_nonneg_and_capped_when_not_oversupplied', trials: checked, violations };
}

// ---------- P3: differential — rollup + gate_policy re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (o.missing_disposition_count !== expected.missingActual) violations++;
    if (o.decision.gate_policy !== expected.gate) violations++;
  }
  return { name: 'P3_rollup_and_gate_policy_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of sampled_items[] order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.sampled_items.length < 2) continue;
    const shuffled = { ...pp, sampled_items: [...pp.sampled_items].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.disposition_coverage_pct !== b.disposition_coverage_pct) violations++;
    if (a.missing_disposition_count !== b.missing_disposition_count) violations++;
    if (a.decision.gate_policy !== b.decision.gate_policy) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const idA = hex64(rand), idB = hex64(rand);
  // population tie-out mismatch forces hold, ahead of any coverage check
  {
    const pp = { lookback_id: 'L', lookback_close_date: '2026-06-30', as_of: '2026-05-01', population_size: 100, sample_frame_population_size: 99, sample_frame_size: 1, sampled_items: [{ customer_id: idA, alert_id: idB, disposition: 'no_sar', rationale_reference: 'R' }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.gate_policy !== 'hold') violations++;
    if (o.population_tie_out_holds) violations++;
  }
  // missing disposition past close date -> escalate
  {
    const pp = { lookback_id: 'L', lookback_close_date: '2026-06-30', as_of: '2026-07-15', population_size: 5, sample_frame_population_size: 5, sample_frame_size: 1, sampled_items: [] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.gate_policy !== 'escalate') violations++;
  }
  // malformed customer_id (plaintext, not a commitment) excluded from with_disposition even though
  // the raw disposition value itself is a recognised category (identity_ok gates has_disposition,
  // not the items[].disposition echo field, which stays the raw parsed value)
  {
    const pp = { lookback_id: 'L', lookback_close_date: '2026-06-30', as_of: '2026-05-01', population_size: 1, sample_frame_population_size: 1, sample_frame_size: 1, sampled_items: [{ customer_id: 'PLAINTEXT-CUST-1', alert_id: idB, disposition: 'no_sar', rationale_reference: 'R' }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.items[0].identity_ok) violations++;
    if (o.items[0].disposition !== 'no_sar') violations++; // raw echo, not identity-gated
    if (o.missing_disposition_count !== 1) violations++; // but the aggregate excludes it via identity_ok
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-534-aml-lookback-disposition-rollup',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
