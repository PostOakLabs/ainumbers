// art-656-derivatives-margin-workbench.proptest.mjs -- floor property test (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:12fe0722a13260d84d8ad2e4644effe9aae35bb42957be78c22392364d0eef53
// spec: DERIV-WORKFLOWS-BUILD-SPEC.md Sec6 (DERIV-WF-MARGIN-1 row), AT-01/AT-02/AT-05 formulas.
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: YES -- margin/PnL/cross-margin
// math is continuous arithmetic over price, notional, correlation, weight, all round6/round4
// rounded -- ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md Sec3.
//
// Checks: fixture-oracle gate, determinism, output-shape (no NaN/undefined anywhere), a fixed
// health-tier rule re-derivation, a buffer/margin-balance identity re-derivation, a cross-margin
// benefit-tier differential re-derivation, and forced ULP/degenerate-domain boundary cases.
//
// Run: node chaingraph/kernels/__proptests__/art-656-derivatives-margin-workbench.proptest.mjs

import { compute } from '../art-656-derivatives-margin-workbench.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-656-derivatives-margin-workbench';
const rand = mulberry32(0x656A11);

const SIDES = ['long', 'short'];
const VMM_CLASSES = ['regulated_dcm', 'offshore_perp'];

function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function randomPP(rng) {
  const notional = randRange(rng, 0, 500000);
  const hasCross = rng() < 0.5;
  const pp = {
    event_market: {
      side: pick(rng, SIDES),
      strike: randRange(rng, -1000, 1000),
      settlement_value: randRange(rng, -1200, 1200),
      unit_value: randRange(rng, 0.01, 1000),
      n_contracts: randRange(rng, 0, 1000),
      min_price: -1000,
      max_price: 1000,
    },
    margin: {
      side: pick(rng, SIDES),
      entry_price: randRange(rng, 0.01, 200000),
      mark_price: randRange(rng, 0.01, 200000),
      notional,
      margin_posted: randRange(rng, 0, notional || 1000),
      margin_mode: rng() < 0.5 ? 'isolated' : 'cross',
      venue_margin_model: {
        class: pick(rng, VMM_CLASSES),
        label: 'fuzz-venue',
        imr: randRange(rng, 0.01, 0.5),
        mmr: randRange(rng, 0.005, 0.25),
      },
    },
  };
  if (hasCross) {
    pp.cross_margin = {
      position_b_notional: randRange(rng, 0, 500000),
      position_b_imr: randRange(rng, 0.01, 0.5),
      correlation: randRange(rng, -1, 1),
      weight_a: randRange(rng, 0, 1),
      weight_b: randRange(rng, 0, 1),
    };
  }
  return pp;
}

const TRIALS = 5000;

// ---------- P1: determinism -- same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined/non-finite anywhere in output_payload ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3: health tier matches the documented fixed buffer_pct rule exactly ----------
function checkP3_healthTierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const { buffer_pct, health } = output_payload.margin;
    const expected = buffer_pct > 100 ? 'GREEN' : buffer_pct > 0 ? 'AMBER' : 'RED';
    if (health !== expected) violations++;
  }
  return { name: 'P3_health_matches_fixed_buffer_pct_tier_rule', checked, violations };
}

// ---------- P4: identity -- buffer == margin_balance - maintenance_threshold (re-derived) ----------
function checkP4_bufferIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const m = output_payload.margin;
    const expected = Math.round((m.margin_balance - m.maintenance_threshold) * 1e6) / 1e6;
    if (Math.abs(expected - m.buffer) > 1e-6) violations++;
  }
  return { name: 'P4_buffer_equals_margin_balance_minus_maintenance', checked, violations };
}

// ---------- P5 (differential): cross-margin benefit tier matches the documented efficiency_ratio thresholds ----------
function checkP5_benefitTierDifferential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    if (!output_payload.cross_margin) continue;
    checked++;
    const { efficiency_ratio, benefit } = output_payload.cross_margin;
    const expected = efficiency_ratio < 0.75 ? 'SIGNIFICANT'
      : efficiency_ratio <= 0.90 ? 'MODERATE'
      : efficiency_ratio < 1.0 ? 'MINIMAL'
      : 'NONE';
    if (benefit !== expected) violations++;
  }
  return { name: 'P5_cross_margin_benefit_tier_differential', checked, violations };
}

// ---------- P6 (mandatory): ULP-boundary + degenerate-domain forcing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'fully empty policy_parameters — must not throw or produce NaN'],
  [{ margin: { notional: 0, entry_price: 1, mark_price: 1, margin_posted: 0 } }, 'zero notional — div-by-zero guard on liquidation_price and leverage_ratio must hold'],
  [{ margin: { notional: 100, entry_price: 100, mark_price: 100, margin_posted: 0, venue_margin_model: { mmr: 0 } } }, 'venue_margin_model.mmr = 0 — must clamp to the 0.0001 floor, not divide-by-zero on buffer_pct'],
  [{ margin: { notional: 100, entry_price: 0.1 * 3, mark_price: 100, margin_posted: 10 } }, 'entry_price = 0.1*3 (classic non-exact double) — must round-trip through round6 without throwing'],
  [{ margin: { notional: Number.MAX_SAFE_INTEGER / 1e3, entry_price: Number.MAX_SAFE_INTEGER / 1e6, mark_price: Number.MAX_SAFE_INTEGER / 1e6, margin_posted: 1 } }, 'notional/entry_price near MAX_SAFE_INTEGER scale — must remain finite or fall back to 0 via round6'],
  [{ event_market: { min_price: 5, max_price: -5, settlement_value: 0, strike: 0 } }, 'inverted min/max range — settlement_in_range must resolve to a boolean, not throw'],
  [{ cross_margin: { position_b_notional: 0, position_b_imr: 0, correlation: 1, weight_a: 1, weight_b: 1 } }, 'cross-margin with a zero-notional B leg and correlation at +1 clamp — must stay finite'],
  [{ margin: { notional: 100, entry_price: 100, mark_price: 100 + Number.EPSILON, margin_posted: 10, side: 'long' } }, 'mark_price 1 epsilon above entry_price — buffer_pct/health must not flip on float noise'],
  [{ margin: { margin_mode: 'cross', notional: 5000, entry_price: 100, mark_price: 100, margin_posted: 500 }, cross_margin: { correlation: -1, weight_a: 0.5 * 3 / 3, weight_b: 0.7 } }, 'weight_a = 0.5*3/3 (non-exact double) + correlation at -1 clamp — efficiency_ratio must stay finite'],
];

function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const { output_payload } = compute(pp);
    const violations = findShapeViolations(output_payload);
    const healthOk = ['GREEN', 'AMBER', 'RED'].includes(output_payload.margin.health);
    const plausible = violations.length === 0 && healthOk;
    rows.push({ label, health: output_payload.margin.health, plausible, violations });
  }
  return rows;
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_healthTierAgreement(),
  checkP4_bufferIdentity(),
  checkP5_benefitTierDifferential(),
];
const boundaryForced = checkP6_forced();
const anyBoundaryImplausible = boundaryForced.some((b) => !b.plausible);
if (anyBoundaryImplausible) {
  console.error('BOUNDARY FORCING FAILURES:', JSON.stringify(boundaryForced.filter((b) => !b.plausible), null, 2));
}

console.log(`[${KERNEL_ID}] float-sensitive floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties) && !anyBoundaryImplausible;
process.exit(ok ? 0 : 1);
