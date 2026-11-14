// art-769-medicare-oop-exposure — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// Authored against the APEXPORT-152 porting payload (GRADES PASS-PENDING-XV 2026-10-18,
// builder-verifies-at-land 50/50) and the 2026-11-13 adjudication (Plan G ceiling null,
// worst_case_spend_multiplier input, tier-6 refusal kept).
// kernel_digest_at_authoring: sha256:8da5afef94905e85214f687d89d290ee3e272913db2e52d117496d7f30b859d1
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
// P7 input contract (unsafe, over-bound, null, string, non-object refuse by name; prototype-name keys ignored);
// P8 buildArtifact_never_throws on inputs the shared canonicalizer cannot hash.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-769-medicare-oop-exposure.proptest.mjs

import { compute, buildArtifact } from '../art-769-medicare-oop-exposure.kernel.mjs';
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

// P7 -- input contract (D1 to D3): unsafe or over-bound counts and money, a string or null
// plan_year, a null multiplier and a non-object input refuse by name, never coerce. A caller
// key named like a prototype member is an ordinary ignored key.
function checkP7InputContract() {
  let checked = 0, violations = 0;
  const bad = [
    { benefit_periods: 1e300 }, { benefit_periods: 1e12 }, { benefit_periods: 101 }, { days_per_period: 1e300 },
    { days_per_period: 367 }, { snf_days: 1e300 }, { snf_days: Number.MAX_SAFE_INTEGER },
    { supplemental_monthly_premium_cents: 1e15 }, { part_b_approved_charges_cents: Number.MAX_SAFE_INTEGER - 1 },
    { annual_drug_cost_cents: Number.MAX_SAFE_INTEGER - 1 }, { advantage_moop_cents: 1e300 },
    { zzz_unknown: 1e300 }, { plan_year: '2026' }, { plan_year: null }, { plan_year: [2026] },
    { worst_case_spend_multiplier: null }, { worst_case_spend_multiplier: '4' },
    { irmaa_tier: null }, { benefit_periods: '1' }, { benefit_periods: true },
  ];
  for (const delta of bad) {
    const o = compute({ ...basePP(), ...delta }).output_payload;
    checked++;
    if (o.valid_input !== false || o.domain_errors.length < 1 || o.rough !== null) { violations++; console.log(`P7 violation: ${Object.keys(delta)[0]} not refused`); }
  }
  for (const nonObj of [null, undefined, 5, 'x', [], [basePP()]]) {
    const o = compute(nonObj).output_payload;
    checked++;
    if (o.valid_input !== false || !/^REFUSED_INPUT_WRONG_TYPE/.test(o.domain_errors[0])) { violations++; console.log('P7 violation: non-object not refused'); }
  }
  const absent = { ...basePP() }; delete absent.plan_year;
  checked++;
  if (compute(absent).output_payload.valid_input !== true) { violations++; console.log('P7 violation: absent plan_year refused'); }
  const proto = JSON.parse(JSON.stringify(basePP()).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"benefit_periods":99}}');
  checked++;
  if (JSON.stringify(compute(proto).output_payload) !== JSON.stringify(compute(basePP()).output_payload)) { violations++; console.log('P7 violation: prototype-name keys changed the output'); }
  return { name: 'P7 input contract: unsafe/over-bound/null/string refuse, prototype keys ignored', checked, violations };
}

// P8 (D6) -- buildArtifact_never_throws: an input whose {policy_parameters, output_payload}
// preimage the shared canonicalizer would reject mints an artifact with a null execution_hash
// and a hash_refusal beside it; a clean input (accepted or refused) gets a 64-hex hash.
async function checkP8BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const hostile = [
    { benefit_periods: 1e300 }, { zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { zzz: deep }, { zzz: wide },
  ];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...basePP(), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log(`P8 violation: ${Object.keys(delta)[0]} artifact shape`); }
      if (/e\+3\d\d|Infinity|9007199254740992/.test(JSON.stringify(r))) { violations++; console.log('P8 violation: hostile value echoed'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P8 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log(`P8 violation: buildArtifact threw: ${String(e.message).slice(0, 80)}`); }
  }
  for (const pp of [basePP(), { ...basePP(), irmaa_tier: 9 }, { ...basePP(), plan_year: '2026' }, null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P8 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log(`P8 violation: buildArtifact threw on clean input: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
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
  checkP7InputContract(),
  await checkP8BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
