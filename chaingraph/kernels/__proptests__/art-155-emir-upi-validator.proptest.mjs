// art-155-emir-upi-validator property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:2be3027f20c68ebb83ae9bccb958a04a894f56b2b7acda2a0ff5bf0e091d6f0f
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: three scalar checks
// (regex format check on `upi`, set-membership on `asset_class`, non-empty-string check on
// `instrument_type`) ANDed into upi_valid -- scalar enum/string checks per the row's own
// description. float:no (upi/instrument_type are strings, asset_class a declared enum) -- forced
// CATEGORICAL boundary cases (every declared asset class, plus the format regex's own length/
// charset boundary) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins
// only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-155-emir-upi-validator.proptest.mjs

import { compute } from '../art-155-emir-upi-validator.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-155-emir-upi-validator';

const ASSET_CLASSES = ['IR', 'CR', 'EQ', 'CO', 'FX'];
const INVALID_ASSET_CLASSES = ['XX', '', null];
const VALID_UPI = 'DJMM0VX7HY4A'; // 12 alnum chars, matches ISO 4914 ANNA DSB shape

function randomUpi(rng) {
  const choices = [
    VALID_UPI,
    VALID_UPI.toLowerCase(),
    VALID_UPI.slice(0, 11), // too short
    VALID_UPI + 'X', // too long
    'DJMM0VX7HY-A', // illegal char
    '', // empty
    null,
  ];
  return pick(rng, choices);
}
function randomInstrumentType(rng) {
  return pick(rng, ['IRS', 'CDS', '', null, undefined]);
}
function randomAssetClass(rng) {
  return pick(rng, [...ASSET_CLASSES, ...INVALID_ASSET_CLASSES]);
}

function expectedFormatOk(upi) {
  return typeof upi === 'string' && /^[A-Z0-9]{12}$/i.test(upi);
}

// P1: format_ok / asset_ok / classification_consistent / upi_valid all agree with the kernel's
// own declared boolean algebra.
function checkP1_booleanAlgebraAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(155001);
  for (let i = 0; i < 300; i++) {
    const pp = { upi: randomUpi(rng), asset_class: randomAssetClass(rng), instrument_type: randomInstrumentType(rng) };
    const { output_payload } = compute(pp);
    checked++;
    const formatOk = expectedFormatOk(pp.upi);
    const assetOk = ASSET_CLASSES.includes(pp.asset_class);
    const classConsistent = assetOk && typeof pp.instrument_type === 'string' && pp.instrument_type.length > 0;
    if (output_payload.format_ok !== formatOk) violations++;
    if (output_payload.asset_ok !== assetOk) violations++;
    if (output_payload.classification_consistent !== classConsistent) violations++;
    if (output_payload.upi_valid !== (formatOk && classConsistent)) violations++;
    if (output_payload.asset_class !== (pp.asset_class ?? null)) violations++;
  }
  return { name: 'P1_boolean_algebra_agreement_random300', checked, violations };
}

// P2: compliance_flags baseline shape -- always-present tag, exactly-one valid/invalid tag,
// malformed/mismatch tags exactly when their driving boolean is false.
function checkP2_complianceFlagsShape() {
  let violations = 0, checked = 0;
  const rng = mulberry32(155002);
  for (let i = 0; i < 300; i++) {
    const pp = { upi: randomUpi(rng), asset_class: randomAssetClass(rng), instrument_type: randomInstrumentType(rng) };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('EMIR_UPI_ASSESSED')) violations++;
    const validTag = compliance_flags.includes('EMIR_UPI_VALID');
    const invalidTag = compliance_flags.includes('EMIR_UPI_INVALID');
    if (validTag === invalidTag) violations++;
    if (validTag !== output_payload.upi_valid) violations++;
    if (!output_payload.format_ok !== compliance_flags.includes('UPI_MALFORMED')) violations++;
    if (!output_payload.classification_consistent !== compliance_flags.includes('UPI_CLASSIFICATION_MISMATCH')) violations++;
  }
  return { name: 'P2_compliance_flags_shape_random300', checked, violations };
}

// P3: forced categorical boundary cases -- every declared asset class (valid + one invalid), and
// the regex's own length boundary (11/12/13 chars) and case-insensitivity.
function checkP3_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const ac of [...ASSET_CLASSES, 'XX']) {
    const { output_payload } = compute({ upi: VALID_UPI, asset_class: ac, instrument_type: 'IRS' });
    checked++;
    if (output_payload.asset_ok !== ASSET_CLASSES.includes(ac)) violations++;
  }
  const lengthCases = [VALID_UPI.slice(0, 11), VALID_UPI, VALID_UPI + 'X', VALID_UPI.toLowerCase()];
  for (const upi of lengthCases) {
    const { output_payload } = compute({ upi, asset_class: 'IR', instrument_type: 'IRS' });
    checked++;
    if (output_payload.format_ok !== expectedFormatOk(upi)) violations++;
  }
  return { name: 'P3_forced_categorical_boundary_cases', checked, violations };
}

// P4: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { upi: VALID_UPI }, { asset_class: 'IR' }, { upi: null, asset_class: null, instrument_type: null }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.upi_valid !== 'boolean') violations++;
    if (typeof output_payload.format_ok !== 'boolean') violations++;
    if (typeof output_payload.asset_ok !== 'boolean') violations++;
    if (typeof output_payload.classification_consistent !== 'boolean') violations++;
    if (findShapeViolations({ upi_valid: output_payload.upi_valid, format_ok: output_payload.format_ok, asset_ok: output_payload.asset_ok, classification_consistent: output_payload.classification_consistent }).length) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_booleanAlgebraAgreement(),
  checkP2_complianceFlagsShape(),
  checkP3_forcedCategoricalBoundaries(),
  checkP4_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
