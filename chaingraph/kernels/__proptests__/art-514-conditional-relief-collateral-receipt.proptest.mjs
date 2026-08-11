// art-514-conditional-relief-collateral-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:b4e574eae79a1ae5d3d37e79cb155af73e2d4d9a14b9e346737a1b9c144daefa
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — CORRECTED from the WU row's float:no (per FIX-2 discipline). Direct source
// read: `applicable_capital_charge = r2(position_size * (applicable_charge_pct / 100))` and
// `revocation_capital_charge = r2(position_size * (revocation_charge_pct / 100))` are each independent
// IEEE-754 divisions and multiplications, and `revocation_capital_delta = r2(revocation_capital_charge
// - applicable_capital_charge)` then gates `revocation_exposure_material` via `> 0`. Because the two
// charge percentages are rounded INDEPENDENTLY before their difference is taken, equal percentages are
// not guaranteed to r2()-round to bit-identical charges, so the `> 0` boundary is genuinely
// ULP-sensitive. ULP-boundary forcing is mandatory here.
// Checks: fixture-oracle gate, termination (conditions bounded by input array length, never filtered),
// differential re-derivation of applicable/revocation capital charges, permutation-invariance of the
// conditions array (all_conditions_met/any_breach/any_undecidable are order-independent boolean
// aggregations), and ULP-boundary forcing around the equal-percentage zero-delta boundary and the
// pct/100 division.
//
// Run: node chaingraph/kernels/__proptests__/art-514-conditional-relief-collateral-receipt.proptest.mjs

import { compute } from '../art-514-conditional-relief-collateral-receipt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-514-conditional-relief-collateral-receipt.fixtures.json');
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
const rand = mulberry32(0x51400);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomConditions(rng) {
  const n = Math.floor(rng() * 5);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ condition_id: `C${i}`, description: 'd', evidence_status: pick(rng, ['met', 'not_met', 'undecided', 'bogus']) });
  }
  return out;
}

function randomPP(rng) {
  const chargePct = rng() * 20;
  return {
    relief_regime: 'CFTC-NOACTION-1', relied_on_version: 'v1',
    condition_set: { version: 'v1', conditions: randomConditions(rng) },
    asset_class: pick(rng, ['payment_stablecoin', 'btc', 'eth', 'tokenized_treasury']),
    issuer_permitted_status: rng() < 0.5,
    declared_valuation: rng() * 1_000_000,
    declared_haircut_pct: rng() * 20,
    declared_reporting_cadence: 'monthly',
    last_report_ref: 'R1',
    position_size: rng() * 500_000,
    capital_charge_table: [
      { asset_class: 'payment_stablecoin', charge_pct: chargePct },
      { asset_class: 'btc', charge_pct: chargePct + 5 },
      { asset_class: 'eth', charge_pct: chargePct + 3 },
      { asset_class: 'tokenized_treasury', charge_pct: chargePct - 2 },
    ],
    revocation_charge_pct: chargePct + (rng() - 0.5) * 4,
    revocation_eligible_without_relief: rng() < 0.5,
    as_of: '2026-08-11',
  };
}

const TRIALS = 3000;

// ---------- P1: termination — conditions bounded by input array length, never filtered ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.conditions.length !== pp.condition_set.conditions.length) violations++;
  }
  return { name: 'P1_conditions_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): applicable/revocation capital charge re-derived ----------
function checkP2_charge_differential() {
  let violations = 0, checked = 0;
  const r2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const positionSize = Math.max(0, pp.position_size);
    if (output_payload.applicable_charge_pct !== null) {
      const expected = r2(positionSize * (output_payload.applicable_charge_pct / 100));
      if (Math.abs(output_payload.applicable_capital_charge - expected) > 1e-9) violations++;
    }
    if (output_payload.revocation_charge_pct !== null) {
      const expected = r2(positionSize * (output_payload.revocation_charge_pct / 100));
      if (Math.abs(output_payload.revocation_capital_charge - expected) > 1e-9) violations++;
    }
  }
  return { name: 'P2_capital_charge_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting conditions never changes the aggregate verdicts ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.condition_set.conditions.length < 2) continue;
    const shuffled = { ...pp, condition_set: { ...pp.condition_set, conditions: [...pp.condition_set.conditions].sort(() => rand() - 0.5) } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.all_conditions_met !== r2.all_conditions_met) violations++;
    if (JSON.stringify([...r1.conditions].map((c) => c.verdict).sort()) !== JSON.stringify([...r2.conditions].map((c) => c.verdict).sort())) violations++;
  }
  return { name: 'P3_conditions_order_invariance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around the equal-percentage zero-delta boundary ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const base = {
    relief_regime: 'R', relied_on_version: 'v1', condition_set: { version: 'v1', conditions: [{ condition_id: 'C1', evidence_status: 'met' }] },
    asset_class: 'btc', issuer_permitted_status: true, declared_valuation: 1000, declared_reporting_cadence: 'm', last_report_ref: 'r',
    revocation_eligible_without_relief: true, as_of: 'x',
  };

  // equal applicable and revocation percentages -> delta must be exactly 0, never spuriously material
  const equalPcts = [0.1, 1 / 3, 12.345, 33.33, Number.EPSILON * 100];
  for (const pct of equalPcts) {
    checked++;
    const pp = {
      ...base, position_size: 123456.78, declared_haircut_pct: pct,
      capital_charge_table: [{ asset_class: 'btc', charge_pct: pct }],
      revocation_charge_pct: pct,
    };
    const { output_payload } = compute(pp);
    if (output_payload.revocation_capital_delta !== 0) violations++;
    if (output_payload.revocation_exposure_material !== false) violations++;
  }

  // 0, negative zero, denormal position_size never throw and never produce NaN/undefined
  for (const ps of [0, -0, Number.MIN_VALUE, Number.EPSILON]) {
    checked++;
    const pp = { ...base, position_size: ps, declared_haircut_pct: 5, capital_charge_table: [{ asset_class: 'btc', charge_pct: 5 }], revocation_charge_pct: 7 };
    const { output_payload } = compute(pp);
    if (output_payload.applicable_capital_charge === undefined || Number.isNaN(output_payload.applicable_capital_charge)) violations++;
  }

  // x/y*y !== x style case constructed for the charge percentage
  checked++;
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    const pct = 10 + (derived - x);
    const pp = { ...base, position_size: 50000, declared_haircut_pct: pct, capital_charge_table: [{ asset_class: 'btc', charge_pct: pct }], revocation_charge_pct: pct };
    const { output_payload } = compute(pp);
    if (output_payload.revocation_capital_delta !== 0) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_equal_pct_zero_delta', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_charge_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-514-conditional-relief-collateral-receipt',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
