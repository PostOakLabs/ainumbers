// art-768-medicare-plan-comparison.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-151 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18; builder-verifies-at-land: all payload vectors re-executed through the
// landed kernel compute() with zero mismatches, 2026-11-13).
// kernel_digest_at_authoring: sha256:803cd25278c1e101175204b9fda2fc474859e9e78aaf2ba4f7cdfe43d5d18dda
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO for the asserted relations — the kernel rounds every money
// intermediate half-up to the cent, so the properties assert only restatements of the
// published structure (totals as sums, difference as the rounded gap, the Part D
// deductible clamp, the refusal contract), with a one-cent tolerance on sums.
//
// Checks: fixture-oracle gate (every payload vector: 5 Apex live scenarios and the 22
// boundary fixtures at / just past / one step before each comparator);
// P1 determinism (byte-equal reruns) and output shape (no undefined/NaN/non-finite);
// P2 the refusal contract: a negative, blank, non-finite or out-of-enum input yields
// valid_input false, a named domain error, no money figure and the
// ART768_INPUT_OUT_OF_DECLARED_DOMAIN flag, never a coerced zero;
// P3 each path total equals premiums + medical + drugs within a cent;
// P4 comparison identity: annual_difference_usd is the rounded Path A minus Path B gap
// and lower_cost_path follows its sign;
// P5 the Part D deductible clamp: applied == min(declared, 615) and clamped is
// exactly (declared > 615), with the matching flag;
// P6 the Part D cap: Path A drug cost sharing never exceeds the $2,100 threshold;
// P7 the adjudicated literals pinned: HDG Plan G deductible 2950, clamp to 615, MOOP flag above 9250.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-768-medicare-plan-comparison.proptest.mjs

import { compute, buildArtifact } from '../art-768-medicare-plan-comparison.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-768-medicare-plan-comparison';

const basePP = (over = {}) => ({
  irmaa_tier: 0, admissions_per_year: 0, primary_visits_per_year: 4, specialist_visits_per_year: 4,
  length_of_stay_days: 4, outpatient_charges_usd: 4000, annual_drug_cost_usd: 2500,
  medigap_premium_monthly_usd: 165, medigap_plan_type: 'PlanG', part_d_premium_monthly_usd: 35.09,
  part_d_deductible_a_usd: 615, ma_premium_monthly_usd: 0, part_b_giveback_monthly_usd: 0,
  ma_primary_copay_usd: 10, ma_specialist_copay_usd: 45, ma_inpatient_copay_per_day_usd: 325,
  ma_inpatient_copay_days: 5, ma_outpatient_coinsurance_pct: 20, ma_moop_usd: 5000,
  ma_drug_coverage_included: true, ma_plan_drug_deductible_usd: 0, ...over,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PLANS = ['PlanG', 'PlanN', 'HDG', 'None'];
const randomPP = (rng) => basePP({
  irmaa_tier: Math.floor(rng() * 6),
  admissions_per_year: Math.floor(rng() * 4),
  primary_visits_per_year: Math.floor(rng() * 20),
  specialist_visits_per_year: Math.floor(rng() * 20),
  length_of_stay_days: Math.floor(rng() * 40),
  outpatient_charges_usd: Math.floor(rng() * 60000),
  annual_drug_cost_usd: Math.floor(rng() * 40000),
  medigap_premium_monthly_usd: Math.floor(rng() * 400),
  medigap_plan_type: pick(rng, PLANS),
  part_d_deductible_a_usd: Math.floor(rng() * 800),
  ma_moop_usd: Math.floor(rng() * 10000),
  ma_drug_coverage_included: rng() < 0.7,
  ma_plan_drug_deductible_usd: Math.floor(rng() * 800),
});

function checkP1DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76801);
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (!deepEqual(a, b)) { violations++; console.log('P1 violation: two runs differ'); }
    const v = findShapeViolations(a.output_payload);
    if (v.length) { violations++; console.log('P1 shape violations: ' + v.slice(0, 3).join('; ')); }
  }
  return { name: 'P1 determinism (byte-equal reruns) and shape (no undefined/NaN/non-finite)', checked, violations };
}

function checkP2Refusal() {
  let checked = 0, violations = 0;
  const bad = [
    ['irmaa_tier', 6], ['irmaa_tier', -1], ['irmaa_tier', 1.5], ['outpatient_charges_usd', -0.01],
    ['annual_drug_cost_usd', -1], ['admissions_per_year', -1], ['medigap_premium_monthly_usd', -5],
    ['part_d_premium_monthly_usd', -1], ['ma_moop_usd', -1], ['ma_outpatient_coinsurance_pct', 101],
    ['ma_outpatient_coinsurance_pct', -1], ['medigap_plan_type', 'PlanF'], ['medigap_plan_type', ''],
    ['primary_visits_per_year', null], ['specialist_visits_per_year', undefined], ['length_of_stay_days', NaN],
    ['outpatient_charges_usd', Infinity], ['ma_premium_monthly_usd', '12'],
  ];
  for (const [k, v] of bad) {
    const out = compute(basePP({ [k]: v })).output_payload;
    const r = compute(basePP({ [k]: v }));
    checked++;
    const ok = out.valid_input === false && out.domain_errors.length > 0 && out.typical_year === null
      && out.comparison === null && r.compliance_flags.includes('ART768_INPUT_OUT_OF_DECLARED_DOMAIN');
    if (!ok) { violations++; console.log(`P2 violation: ${k}=${String(v)} was not refused by name`); }
  }
  return { name: 'P2 out-of-domain inputs are refused (named reason, no money figure, flag), never coerced', checked, violations };
}

function checkP3PathTotals() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76803);
  for (let i = 0; i < 60; i++) {
    const out = compute(randomPP(rng)).output_payload;
    for (const yr of [out.typical_year, out.bad_year]) {
      for (const p of [yr.path_a, yr.path_b]) {
        checked++;
        if (Math.abs(p.premiums_usd + p.medical_usd + p.drugs_usd - p.total_usd) > 0.011) {
          violations++; console.log(`P3 violation: total ${p.total_usd} != ${p.premiums_usd}+${p.medical_usd}+${p.drugs_usd}`);
        }
      }
    }
  }
  return { name: 'P3 each path total == premiums + medical + drugs (within one cent)', checked, violations };
}

function checkP4ComparisonIdentity() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76804);
  for (let i = 0; i < 60; i++) {
    const out = compute(randomPP(rng)).output_payload;
    const c = out.comparison;
    const wantDiff = Math.round((out.typical_year.path_a.total_usd - out.typical_year.path_b.total_usd) * 100) / 100;
    const wantBad = Math.round((out.bad_year.path_a.total_usd - out.bad_year.path_b.total_usd) * 100) / 100;
    const sign = (d) => (d > 0 ? 'B' : d < 0 ? 'A' : 'tie');
    checked += 4;
    if (Math.abs(c.annual_difference_usd - wantDiff) > 0.011) { violations++; console.log('P4 violation: annual difference'); }
    if (Math.abs(c.bad_year_difference_usd - wantBad) > 0.011) { violations++; console.log('P4 violation: bad-year difference'); }
    if (c.lower_cost_path !== sign(c.annual_difference_usd)) { violations++; console.log('P4 violation: lower_cost_path sign'); }
    if (c.bad_year_lower_cost_path !== sign(c.bad_year_difference_usd)) { violations++; console.log('P4 violation: bad-year lower_cost_path sign'); }
  }
  return { name: 'P4 comparison identity: difference == rounded A - B; lower_cost_path follows its sign', checked, violations };
}

function checkP5DeductibleClamp() {
  let checked = 0, violations = 0;
  for (const ded of [0, 1, 614, 614.99, 615, 615.01, 616, 900, 5000]) {
    const r = compute(basePP({ part_d_deductible_a_usd: ded, ma_plan_drug_deductible_usd: ded }));
    const out = r.output_payload;
    const clamped = ded > 615;
    checked += 4;
    if (out.part_d_deductible_a_applied_usd !== Math.min(ded, 615)) { violations++; console.log(`P5 violation: A applied for ${ded}`); }
    if (out.part_d_deductible_a_clamped !== clamped) { violations++; console.log(`P5 violation: A clamped flag for ${ded}`); }
    if (out.ma_plan_drug_deductible_clamped !== clamped) { violations++; console.log(`P5 violation: B clamped flag for ${ded}`); }
    if (r.compliance_flags.includes('ART768_PART_D_DEDUCTIBLE_A_CLAMPED') !== clamped) { violations++; console.log(`P5 violation: A flag for ${ded}`); }
  }
  return { name: 'P5 Part D deductible clamp: applied == min(declared, 615); flag iff declared > 615', checked, violations };
}

function checkP6PartDCap() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76806);
  for (let i = 0; i < 60; i++) {
    const out = compute(randomPP(rng)).output_payload;
    for (const yr of [out.typical_year, out.bad_year]) {
      checked++;
      if (yr.path_a.drugs_usd > 2100 + 0.011) { violations++; console.log(`P6 violation: Path A drugs ${yr.path_a.drugs_usd} above the 2100 cap`); }
    }
  }
  return { name: 'P6 Path A drug cost sharing never exceeds the 2026 Part D out-of-pocket threshold', checked, violations };
}

// P7 — adjudicated literals pinned (shepherd-seat 2026-11-13): D1 the official 2026 HDG Plan G
// deductible is 2950 (the Apex 2900 is reachable only as a declared override); D5 a 900
// deductible clamps to 615; D11 a MOOP above 9250 is flagged and never clamped.
function checkP7AdjudicatedLiterals() {
  let checked = 0, violations = 0;
  const off = compute(basePP({ medigap_plan_type: 'HDG' })).output_payload;
  checked++;
  if (off.constants_used.high_deductible_plan_g_deductible_usd !== 2950) { violations++; console.log('P7 violation: HDG deductible default is not 2950'); }
  const ovr = compute(basePP({ medigap_plan_type: 'HDG', high_deductible_plan_g_deductible_usd: 2900 }));
  checked++;
  if (ovr.output_payload.constants_used.high_deductible_plan_g_deductible_usd !== 2900 || !ovr.compliance_flags.includes('ART768_CONSTANT_OVERRIDE')) { violations++; console.log('P7 violation: 2900 override not honoured and flagged'); }
  const clamp = compute(basePP({ part_d_deductible_a_usd: 900 })).output_payload;
  checked++;
  if (clamp.part_d_deductible_a_applied_usd !== 615) { violations++; console.log('P7 violation: 900 deductible did not clamp to 615'); }
  const moop = compute(basePP({ ma_moop_usd: 9300 }));
  checked += 2;
  if (!moop.compliance_flags.includes('ART768_MA_MOOP_ABOVE_2026_IN_NETWORK_MAXIMUM')) { violations++; console.log('P7 violation: MOOP 9300 not flagged'); }
  if (moop.output_payload.comparison.path_b_worst_case_ceiling_usd < 9300) { violations++; console.log('P7 violation: MOOP 9300 was clamped'); }
  const at = compute(basePP({ ma_moop_usd: 9250 }));
  checked++;
  if (at.compliance_flags.includes('ART768_MA_MOOP_ABOVE_2026_IN_NETWORK_MAXIMUM')) { violations++; console.log('P7 violation: MOOP exactly 9250 flagged'); }
  return { name: 'P7 adjudicated literals: HDG 2950 default (2900 only by override), 900 clamps to 615, MOOP flag above 9250 without clamping', checked, violations };
}

// P8 — input contract (KERNEL-INPUT-CONTRACT-1): D1 I-JSON parity (nothing compute() accepts may make
// buildArtifact() throw), D2 presence (a present null refuses), D3 integer domain (counts are safe
// integers), plus prototype names and an unknown key. Every case must refuse by name.
async function checkP8InputContract() {
  let checked = 0, violations = 0;
  const cases = [
    ['D1 outpatient 1e300', { outpatient_charges_usd: 1e300 }],
    ['D1 outpatient 1e17', { outpatient_charges_usd: 1e17 }],
    ['D1 outpatient 2^53+1', { outpatient_charges_usd: 9007199254740993 }],
    ['D1 drug 1e200 x multiplier 1e200', { annual_drug_cost_usd: 1e200, bad_year_charge_multiplier: 1e200 }],
    ['D1 multiplier 1e300', { bad_year_charge_multiplier: 1e300 }],
    ['D1 override part_a_deductible 1e300', { part_a_deductible_usd: 1e300 }],
    ['D1 tier array holding 1e300', { part_b_premium_by_irmaa_tier_usd: [1, 1, 1, 1, 1, 1e300] }],
    ['D1 unknown key junk 1e300', { junk: 1e300 }],
    ['D1 unsafe integer count', { primary_visits_per_year: Number.MAX_SAFE_INTEGER + 2 }],
    ['D2 bad_year_admissions null', { bad_year_admissions: null }],
    ['D2 part_b_deductible_usd null', { part_b_deductible_usd: null }],
    ['D2 bad_year_charge_multiplier null', { bad_year_charge_multiplier: null }],
    ['D3 admissions 1.5', { admissions_per_year: 1.5 }],
    ['D3 primary visits 2.5', { primary_visits_per_year: 2.5 }],
    ['D3 length of stay 0.25', { length_of_stay_days: 0.25 }],
    ['proto plan type __proto__', { medigap_plan_type: '__proto__' }],
    ['proto plan type constructor', { medigap_plan_type: 'constructor' }],
    ['proto unknown key', { toString: 1 }],
  ];
  for (const [label, over] of cases) {
    const pp = basePP(over);
    const r = compute(pp);
    let threw = false;
    try { await buildArtifact(pp); } catch { threw = true; }
    checked++;
    const refused = r.output_payload.valid_input === false && r.output_payload.domain_errors.length > 0
      && r.compliance_flags.includes('ART768_INPUT_OUT_OF_DECLARED_DOMAIN');
    // parity: a valid compute must never be followed by a throwing buildArtifact
    if (!refused || (r.output_payload.valid_input && threw)) { violations++; console.log(`P8 violation: ${label} was not refused`); }
  }
  // deleted required field, and a non-object pp, refuse too
  const del = basePP(); delete del.admissions_per_year;
  for (const pp of [del, null, 0, '', 'str', [], 42]) {
    checked++;
    if (compute(pp).output_payload.valid_input !== false) { violations++; console.log(`P8 violation: ${JSON.stringify(pp)} was accepted`); }
  }
  // valid input still hashes (parity in the accepting direction)
  checked++;
  try { await buildArtifact(basePP()); } catch { violations++; console.log('P8 violation: valid input did not hash'); }
  return { name: 'P8 input contract: I-JSON parity, present null refuses, counts are safe integers, prototype names refuse', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1DeterminismShape(),
  checkP2Refusal(),
  checkP3PathTotals(),
  checkP4ComparisonIdentity(),
  checkP5DeductibleClamp(),
  checkP6PartDCap(),
  checkP7AdjudicatedLiterals(),
  await checkP8InputContract(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
