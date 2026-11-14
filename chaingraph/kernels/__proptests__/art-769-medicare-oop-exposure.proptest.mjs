// art-769-medicare-oop-exposure — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// Authored against the APEXPORT-152 porting payload (GRADES PASS-PENDING-XV 2026-10-18,
// builder-verifies-at-land 50/50) and the 2026-11-13 adjudication (Plan G ceiling null,
// worst_case_spend_multiplier input, tier-6 refusal kept).
// kernel_digest_at_authoring: sha256:99f2b745b5e16971da0235d273a1d1ce0abecb10d396762bfd8081346b760571
// spec: board/claimed/APEX-PORT-152-LAND-RESUME-1.md (SPEC.md §12 compute binding, §17 kernel identity)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO -- integer cents and exact round-half-up basis-point division.
//
// Checks: fixture-oracle gate (57 vectors: 50 payload vectors incl. the tier-6 refusal and
// every boundary pair, plus 7 multiplier-input vectors); P1 OriginalOnly total is
// non-decreasing in Part B approved charges; P2 Plan G / Plan N carry a null annual ceiling
// and the Plan G flag, Plan G medical residual equals the Part B deductible; P3 determinism
// and no undefined/non-finite in output_payload; P4 the refusal contract (tier outside 0-5
// incl. 6, unknown coverage structure, bad multiplier => valid_input false, null scenarios,
// named error, single refusal flag); P5 the multiplier: absent equals explicit 4, routine
// and rough do not move with it, worst total is non-decreasing in it; P6 Part D cost is
// capped at the plan-year threshold and the deductible clamp is reported.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-769-medicare-oop-exposure.proptest.mjs

import { compute } from '../art-769-medicare-oop-exposure.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-769-medicare-oop-exposure';

const basePP = () => ({
  plan_year: 2026, coverage_structure: 'OriginalOnly', irmaa_tier: 0, benefit_periods: 1,
  days_per_period: 5, snf_days: 0, part_b_approved_charges_cents: 600000,
  annual_drug_cost_cents: 250000, part_d_deductible_cents: 61500,
  supplemental_monthly_premium_cents: 16500, advantage_moop_cents: 550000,
  advantage_coinsurance_pct: 20,
});

function jitterPP(rng) {
  const pp = basePP();
  pp.coverage_structure = pick(rng, ['OriginalOnly', 'PlanG', 'PlanN', 'Advantage']);
  pp.irmaa_tier = Math.floor(rng() * 6);
  pp.benefit_periods = Math.floor(rng() * 4);
  pp.days_per_period = Math.floor(rng() * 200);
  pp.snf_days = Math.floor(rng() * 130);
  pp.part_b_approved_charges_cents = Math.floor(rng() * 5000000);
  pp.annual_drug_cost_cents = Math.floor(rng() * 3000000);
  pp.part_d_deductible_cents = Math.floor(rng() * 90000);
  pp.advantage_coinsurance_pct = Math.floor(rng() * 101);
  return pp;
}

// P1 -- more Part B charges never lower the OriginalOnly total.
function checkP1PartBMonotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76901);
  for (let i = 0; i < 40; i++) {
    const lo = { ...jitterPP(rng), coverage_structure: 'OriginalOnly' };
    const hi = { ...lo, part_b_approved_charges_cents: lo.part_b_approved_charges_cents + Math.floor(rng() * 1000000) };
    const a = compute(lo).output_payload.rough.total_with_premiums_cents;
    const b = compute(hi).output_payload.rough.total_with_premiums_cents;
    checked++;
    if (b < a) { violations++; console.log(`P1 violation: ${a} -> ${b}`); }
  }
  return { name: 'P1 OriginalOnly total non-decreasing in Part B charges', checked, violations };
}

// P2 -- Plan G / Plan N have no annual ceiling (adjudication A3).
function checkP2NullCeiling() {
  let checked = 0, violations = 0;
  for (const cs of ['PlanG', 'PlanN', 'OriginalOnly']) {
    const r = compute({ ...basePP(), coverage_structure: cs });
    const o = r.output_payload;
    checked += 3;
    if (o.rough.annual_ceiling_cents !== null || o.unlimited_exposure !== true) { violations++; console.log(`P2 violation: ${cs} ceiling`); }
    if (!r.compliance_flags.includes('NO_ANNUAL_MEDICAL_CEILING')) { violations++; console.log(`P2 violation: ${cs} missing NO_ANNUAL_MEDICAL_CEILING`); }
    if (cs === 'PlanG') {
      if (!r.compliance_flags.includes('PLANG_CEILING_IS_PART_B_DEDUCTIBLE_ONLY')) { violations++; console.log('P2 violation: PlanG flag'); }
      if (o.rough.medical_oop_cents !== 28300) { violations++; console.log('P2 violation: PlanG residual != Part B deductible'); }
    }
  }
  return { name: 'P2 Plan G / Plan N annual ceiling null, Plan G residual = Part B deductible', checked, violations };
}

// P3 -- determinism + shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76903);
  for (let i = 0; i < 30; i++) {
    const pp = jitterPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P3 violation: nondeterministic'); }
    const v = findShapeViolations(a.output_payload);
    if (v.length) { violations++; console.log(`P3 violation: shape ${v.slice(0, 3).join('; ')}`); }
  }
  return { name: 'P3 determinism + no undefined/non-finite in output_payload', checked, violations };
}

// P4 -- refusal contract.
function checkP4Refusal() {
  let checked = 0, violations = 0;
  const bad = [
    { irmaa_tier: 6 }, { irmaa_tier: -1 }, { irmaa_tier: 1.5 }, { coverage_structure: 'Medigap' },
    { worst_case_spend_multiplier: 0 }, { worst_case_spend_multiplier: 101 }, { worst_case_spend_multiplier: 2.5 },
    { plan_year: 2099 }, { benefit_periods: -1 },
  ];
  for (const delta of bad) {
    const r = compute({ ...basePP(), ...delta });
    const o = r.output_payload;
    checked += 4;
    if (o.valid_input !== false || o.domain_errors.length < 1) { violations++; console.log(`P4 violation: ${JSON.stringify(delta)} not refused`); }
    if (o.routine !== null || o.rough !== null || o.worst !== null) { violations++; console.log(`P4 violation: ${JSON.stringify(delta)} produced scenarios`); }
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify(['OOP_INPUT_OUT_OF_DECLARED_DOMAIN'])) { violations++; console.log(`P4 violation: ${JSON.stringify(delta)} flags`); }
    if (JSON.stringify(o.warnings) !== JSON.stringify(r.compliance_flags)) { violations++; console.log(`P4 violation: ${JSON.stringify(delta)} warnings mirror`); }
  }
  const ok = compute({ ...basePP(), irmaa_tier: 5 });
  checked++;
  if (ok.output_payload.valid_input !== true) { violations++; console.log('P4 violation: tier 5 refused'); }
  return { name: 'P4 refusal contract (tier 6, bad structure, bad multiplier, undeclared year)', checked, violations };
}

// P5 -- multiplier semantics (adjudication A2).
function checkP5Multiplier() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76905);
  for (let i = 0; i < 25; i++) {
    const pp = jitterPP(rng);
    const dflt = compute(pp).output_payload;
    const four = compute({ ...pp, worst_case_spend_multiplier: 4 }).output_payload;
    const m1 = 1 + Math.floor(rng() * 20);
    const m2 = m1 + Math.floor(rng() * 20);
    const lo = compute({ ...pp, worst_case_spend_multiplier: m1 }).output_payload;
    const hi = compute({ ...pp, worst_case_spend_multiplier: m2 }).output_payload;
    checked += 4;
    if (JSON.stringify(dflt.worst) !== JSON.stringify(four.worst)) { violations++; console.log('P5 violation: absent != explicit 4'); }
    if (JSON.stringify(lo.routine) !== JSON.stringify(hi.routine) || JSON.stringify(lo.rough) !== JSON.stringify(hi.rough)) { violations++; console.log('P5 violation: routine/rough moved with multiplier'); }
    if (hi.worst.total_with_premiums_cents < lo.worst.total_with_premiums_cents) { violations++; console.log(`P5 violation: worst total fell ${m1}->${m2}`); }
    if (lo.model_assumptions_used.worst_case_spend_multiplier !== m1) { violations++; console.log('P5 violation: multiplier not reported'); }
  }
  return { name: 'P5 multiplier: absent = 4, routine/rough fixed, worst non-decreasing, reported', checked, violations };
}

// P6 -- Part D cap and deductible clamp.
function checkP6PartD() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76906);
  for (let i = 0; i < 30; i++) {
    const pp = jitterPP(rng);
    const o = compute(pp).output_payload;
    checked += 2;
    if (o.rough.part_d_total_cents > 210000) { violations++; console.log('P6 violation: Part D above cap'); }
    if (o.part_d_deductible_clamped !== (pp.part_d_deductible_cents > 61500)) { violations++; console.log('P6 violation: clamp flag'); }
  }
  return { name: 'P6 Part D total <= plan-year OOP cap, deductible clamp reported', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1PartBMonotone(),
  checkP2NullCeiling(),
  checkP3DeterminismShape(),
  checkP4Refusal(),
  checkP5Multiplier(),
  checkP6PartD(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
