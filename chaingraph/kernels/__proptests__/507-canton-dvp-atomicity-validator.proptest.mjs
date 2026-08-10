// 507-canton-dvp-atomicity-validator property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:e8b30471c1feafecb89b5283df71ad9b4f2aeafe3b4606af46ae14e48849f55c
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: two independent
// enum branches (atomicity per settlement_mechanism x platform, finality per finality_type
// lookup table) combined into a verdict, ~4*4*4*2*2=256 enum/bool combos. float:no (all inputs
// are declared string enums / one boolean; settlement_amount/currency pass through unexamined) --
// forced CATEGORICAL boundary cases (every enum value, per spec §3's float:no carve-out) stand
// in for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t.
// the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/507-canton-dvp-atomicity-validator.proptest.mjs

import { compute } from '../507-canton-dvp-atomicity-validator.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '507-canton-dvp-atomicity-validator';

const ENUM_DOMAIN = {
  settlement_mechanism: ['atomic_dvp', 'sequential_with_lock', 'free_delivery', 'other_mechanism'],
  platform: ['canton_daml', 'canton_composerx', 'traditional_csd', 'other_platform'],
  finality_type: ['irrevocable_realtime', 'irrevocable_eod', 'provisional', 'undefined'],
  cash_type: ['wire', 'cbdc'],
};
const VERDICTS = ['PASS', 'FAIL', 'CONDITIONAL'];
const ATOMICITY_STATUSES = ['COMPLIANT', 'CONDITIONAL', 'FAILED'];
const ATOMICITY_FLAGS = ['ATOMICITY_PFMI_P12_COMPLIANT', 'ATOMICITY_CONDITIONAL', 'ATOMICITY_FAILED'];
const FINALITY_FLAGS = ['FINALITY_IRREVOCABLE_REALTIME', 'FINALITY_IRREVOCABLE_EOD', 'FINALITY_PROVISIONAL', 'FINALITY_UNDEFINED'];

function randomPP(rng) {
  return {
    settlement_mechanism: pick(rng, ENUM_DOMAIN.settlement_mechanism),
    platform: pick(rng, ENUM_DOMAIN.platform),
    finality_type: pick(rng, ENUM_DOMAIN.finality_type),
    unwind_protection: rng() < 0.5,
    cash_type: pick(rng, ENUM_DOMAIN.cash_type),
    settlement_amount: Math.floor(rng() * 10_000_000),
    currency: pick(rng, ['USD', 'EUR', 'GBP']),
  };
}

// P1: every output enum field stays within its declared value set.
function checkP1_enumMembership() {
  let violations = 0, checked = 0;
  const rng = mulberry32(507001);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (!VERDICTS.includes(output_payload.verdict)) violations++;
    if (!ATOMICITY_STATUSES.includes(output_payload.atomicity_status)) violations++;
    if (!ATOMICITY_FLAGS.includes(output_payload.atomicity_flag)) violations++;
    if (!FINALITY_FLAGS.includes(output_payload.finality_flag)) violations++;
  }
  return { name: 'P1_enum_membership_random300', checked, violations };
}

// P2: herstatt_eliminated agrees exactly with the PFMI-compliant atomicity flag.
function checkP2_herstattAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(507002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const expected = output_payload.atomicity_flag === 'ATOMICITY_PFMI_P12_COMPLIANT';
    if (output_payload.herstatt_eliminated !== expected) violations++;
  }
  return { name: 'P2_herstatt_agreement_random300', checked, violations };
}

// P3: compliance_flags baseline shape -- required tags present, cash-leg tag exactly when wire,
// herstatt tag present exactly once and matches herstatt_eliminated.
function checkP3_complianceFlagsShape() {
  let violations = 0, checked = 0;
  const rng = mulberry32(507003);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DVP_ATOMICITY_VALIDATED')) violations++;
    if (!compliance_flags.includes(output_payload.atomicity_flag)) violations++;
    if (!compliance_flags.includes(output_payload.finality_flag)) violations++;
    const hasElim = compliance_flags.includes('HERSTATT_RISK_ELIMINATED');
    const hasPresent = compliance_flags.includes('HERSTATT_RISK_PRESENT');
    if (hasElim === hasPresent) violations++; // exactly one must be present
    if (hasElim !== output_payload.herstatt_eliminated) violations++;
    const hasWireTag = compliance_flags.includes('CASH_LEG_NOT_DIGITAL');
    if ((pp.cash_type === 'wire') !== hasWireTag) violations++;
  }
  return { name: 'P3_compliance_flags_shape_random300', checked, violations };
}

// P4: forced categorical boundary cases -- every declared enum value for every dimension.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const base = { settlement_mechanism: 'sequential_with_lock', platform: 'traditional_csd', finality_type: 'provisional', unwind_protection: false, cash_type: 'cbdc', settlement_amount: 500, currency: 'USD' };
  for (const [dim, values] of Object.entries(ENUM_DOMAIN)) {
    for (const v of values) {
      const pp = { ...base, [dim]: v };
      const { output_payload } = compute(pp);
      checked++;
      if (!VERDICTS.includes(output_payload.verdict)) violations++;
      if (findShapeViolations(output_payload).length) violations++;
    }
  }
  // unwind_protection boolean boundary
  for (const v of [true, false]) {
    const { output_payload } = compute({ ...base, unwind_protection: v });
    checked++;
    if (!VERDICTS.includes(output_payload.verdict)) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_enum_values', checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs (excluding
// the two intentionally pass-through fields settlement_amount/currency, which the kernel never
// defaults when omitted).
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { settlement_mechanism: 'free_delivery' }, { platform: 'canton_daml' }, { finality_type: 'undefined', unwind_protection: true }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.includes(output_payload.verdict)) violations++;
    if (typeof output_payload.atomicity_status !== 'string') violations++;
    if (typeof output_payload.herstatt_eliminated !== 'boolean') violations++;
    const otherViolations = findShapeViolations({ verdict: output_payload.verdict, atomicity_status: output_payload.atomicity_status, atomicity_flag: output_payload.atomicity_flag, finality_flag: output_payload.finality_flag, herstatt_eliminated: output_payload.herstatt_eliminated });
    if (otherViolations.length) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_enumMembership(),
  checkP2_herstattAgreement(),
  checkP3_complianceFlagsShape(),
  checkP4_forcedCategoricalBoundaries(),
  checkP5_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
