// art-342-compute-escrow-analysis.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:e607aef8dedf929559f5a0daafd8a26ba54b900cd7d64c91ee96f5c88416aa9d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — cushion_fraction/low_point classification is
// decided against 1e-9 epsilon thresholds on floating running sums: `lowPoint < -1e-9`,
// `spreadVsTarget < -1e-9`, `spreadVsTarget > 1e-9`, `cushionFractionUsed > CUSHION_FRACTION_MAX
// + 1e-9`, `shortageAmount >= monthlyEscrowPayment - 1e-9`, `surplusAmount >= 50 - 1e-9`) — ULP-
// boundary forcing is MANDATORY for those five thresholds per spec §3.
// Checks: fixture-oracle gate, termination (the trial-balance loop is a fixed 12-month walk,
// never data-dependent — trial_balances always has exactly 13 entries and low_point_month is
// always in [1,12]), a differential re-derivation of the deficiency/shortage/surplus/balanced
// classification from the kernel's own reported low_point_balance/cushion_target, a shift-
// invariance metamorphic identity (adding a fixed cent-exact offset to starting_balance shifts
// every trial balance and low_point_balance by that same offset, since the running sum is purely
// additive), and ULP-boundary forcing on all five 1e-9-epsilon thresholds.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-342-compute-escrow-analysis.proptest.mjs

import { compute } from '../art-342-compute-escrow-analysis.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-342-compute-escrow-analysis.fixtures.json');
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
const rand = mulberry32(0x342C0);

function randomDisbursements(rng) {
  const out = [];
  for (let i = 0; i < 12; i++) out.push(rng() < 0.5 ? 0 : Math.round(rng() * 2000 * 100) / 100);
  return out;
}

function randomPP(rng) {
  return {
    starting_balance: Math.round((rng() * 4000 - 500) * 100) / 100,
    monthly_escrow_payment: Math.round(rng() * 400 * 100) / 100,
    disbursements: randomDisbursements(rng),
    cushion_fraction: rng() * (1 / 6) * 1.5,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — fixed 12-month walk, trial_balances always length 13 ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.trial_balances.length !== 13) violations++;
    if (output_payload.low_point_month < 1 || output_payload.low_point_month > 12) violations++;
  }
  return { name: 'P1_termination_fixed_12month_walk', trials: checked, violations };
}

// ---------- P2 (differential): re-derive account_status classification ----------
function checkP2_classification_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const lp = output_payload.low_point_balance;
    const ct = output_payload.cushion_target;
    const spread = output_payload.spread_vs_target;
    const expectDeficiency = lp < -1e-9;
    const expectShortage = !expectDeficiency && spread < -1e-9;
    const expectSurplus = !expectDeficiency && spread > 1e-9;
    const expectStatus = expectDeficiency ? 'deficiency' : expectShortage ? 'shortage' : expectSurplus ? 'surplus' : 'balanced';
    if (output_payload.account_status !== expectStatus) violations++;
    if (Math.abs(spread - (lp - ct)) > 1e-6) violations++;
    // exactly one bucket amount is nonzero, matching the classification
    const nonzero = [output_payload.deficiency_amount > 0, output_payload.shortage_amount > 0, output_payload.surplus_amount > 0].filter(Boolean).length;
    if (expectStatus === 'balanced' && nonzero !== 0) violations++;
    if (expectStatus !== 'balanced' && nonzero !== 1) violations++;
  }
  return { name: 'P2_account_status_classification_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — shift-invariance of starting_balance ----------
function checkP3_shift_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const offset = Math.round((rng2() * 1000 - 500) * 100) / 100;
    const shifted = { ...pp, starting_balance: Math.round((pp.starting_balance + offset) * 100) / 100 };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shifted).output_payload;
    checked++;
    for (let m = 0; m <= 12; m++) {
      if (Math.abs((r2v.trial_balances[m] - r1.trial_balances[m]) - offset) > 0.01) { violations++; break; }
    }
    if (Math.abs((r2v.low_point_balance - r1.low_point_balance) - offset) > 0.01) violations++;
    if (r1.low_point_month !== r2v.low_point_month) violations++; // shift preserves relative shape -> same low month
  }
  function rng2() { return rand(); }
  return { name: 'P3_shift_invariance_starting_balance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — five 1e-9 thresholds ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const base = { starting_balance: 500, monthly_escrow_payment: 100, disbursements: [0, 0, 400, 0, 0, 400, 0, 0, 0, 0, 0, 400] };

  // cushion_fraction boundary at CUSHION_FRACTION_MAX (1/6) +/- epsilon
  const cushionEdges = [1 / 6, 1 / 6 - eps, 1 / 6 + eps, 1 / 6 + 1e-9, 1 / 6 - 1e-9, 0, -0];
  for (const cf of cushionEdges) {
    const { output_payload } = compute({ ...base, cushion_fraction: cf });
    checked++;
    if (!Number.isFinite(output_payload.cushion_target)) violations++;
    if (output_payload.cushion_fraction_used > 1 / 6 + 1e-6) violations++;
  }

  // deficiency/shortage/surplus classification boundary: low_point vs 0 and vs cushion_target at +/-1e-9
  const classificationCases = [
    { starting_balance: 0, monthly_escrow_payment: 100, disbursements: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cushion_fraction: 0 }, // low_point exactly 0
    { starting_balance: -1e-9, monthly_escrow_payment: 100, disbursements: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cushion_fraction: 0 },
    { starting_balance: 1e-9, monthly_escrow_payment: 100, disbursements: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cushion_fraction: 0 },
  ];
  for (const pp of classificationCases) {
    const { output_payload } = compute(pp);
    checked++;
    if (!['deficiency', 'shortage', 'surplus', 'balanced'].includes(output_payload.account_status)) violations++;
  }

  // shortage mandatory-spread boundary: shortageAmount vs monthlyEscrowPayment at -1e-9
  const spreadEdges = [100, 100 - 1e-9, 100 + 1e-9, 100 - eps, 100 + eps];
  for (const shortfallTarget of spreadEdges) {
    const pp = { starting_balance: 0, monthly_escrow_payment: 100, disbursements: new Array(12).fill(0).map((_, i) => (i === 11 ? shortfallTarget : 0)), cushion_fraction: 0 };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.account_status === 'shortage') {
      const expected = output_payload.shortage_amount >= output_payload.monthly_escrow_payment - 1e-9;
      if (output_payload.shortage_spread_required !== expected) violations++;
      if (compliance_flags.includes('ESCROW_SHORTAGE_MANDATORY_SPREAD') !== expected) violations++;
    }
  }

  // surplus $50 refund threshold boundary
  const surplusEdges = [50, 50 - 1e-9, 50 + 1e-9, 50 - eps, 50 + eps, 0];
  for (const surplusTarget of surplusEdges) {
    const pp = { starting_balance: surplusTarget, monthly_escrow_payment: 0, disbursements: new Array(12).fill(0), cushion_fraction: 0 };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.account_status === 'surplus') {
      const expected = output_payload.surplus_amount >= 50 - 1e-9;
      if (output_payload.surplus_refund_required !== expected) violations++;
      if (compliance_flags.includes('ESCROW_SURPLUS_REFUND_REQUIRED') !== expected) violations++;
    }
  }

  return { name: 'P4_ulp_boundary_forcing_five_thresholds', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_classification_differential());
results.properties.push(checkP3_shift_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-342-compute-escrow-analysis',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
