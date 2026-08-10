// art-168-eudr-country-benchmark-risk-scorer property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:0288186f1dd58a2533034a3b040a7d456f2cbb39fb19ee39c3c0b86c4e37bbdc
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: a single 2-char
// country-code lookup against two fixed sets (LOW_RISK 30 codes, HIGH_RISK 5 codes), else
// 'standard', else 'unknown' if malformed -- a 2-char country-code lookup per the row's own
// estimate. float:no (country_code is a string, normalized upper-case) -- forced CATEGORICAL
// boundary cases (one code from each set, a standard non-member code, and the malformed-length
// boundary) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-168-eudr-country-benchmark-risk-scorer.proptest.mjs

import { compute } from '../art-168-eudr-country-benchmark-risk-scorer.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-168-eudr-country-benchmark-risk-scorer';

// Declared sets -- copied verbatim from the kernel source as stated constants.
const LOW_RISK = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO', 'CH', 'GB'];
const HIGH_RISK = ['CD', 'MG', 'MM', 'LA', 'KH'];
const STANDARD_SAMPLE = ['US', 'ZZ', 'CN', 'BR']; // valid 2-char, in neither declared set
const RISK_LEVELS = ['low', 'standard', 'high', 'unknown'];
const INSPECTION_RATES = { low: 1, standard: 3, high: 9, unknown: 0 };

function expectedRisk(cc) {
  if (!cc || cc.length !== 2) return 'unknown';
  if (LOW_RISK.includes(cc)) return 'low';
  if (HIGH_RISK.includes(cc)) return 'high';
  return 'standard';
}

// P1: forced categorical boundary cases -- one code from LOW_RISK, one from HIGH_RISK, one
// standard non-member, plus malformed-length/empty/lowercase boundary cases.
function checkP1_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const cases = [...LOW_RISK, ...HIGH_RISK, ...STANDARD_SAMPLE, '', 'D', 'DEU', 'de', null, undefined];
  for (const country_code of cases) {
    const { output_payload } = compute({ country_code });
    checked++;
    const normalized = typeof country_code === 'string' ? country_code.trim().toUpperCase() : '';
    const expected = expectedRisk(normalized);
    if (output_payload.benchmark_risk !== expected) violations++;
    if (!RISK_LEVELS.includes(output_payload.benchmark_risk)) violations++;
    if (output_payload.country_code !== (normalized || null)) violations++;
  }
  return { name: 'P1_forced_categorical_boundary_cases', checked, violations };
}

// P2: inspection_rate_pct agrees exactly with the declared risk->rate map.
function checkP2_inspectionRateAgreement() {
  let violations = 0, checked = 0;
  const cases = [...LOW_RISK.slice(0, 5), ...HIGH_RISK, ...STANDARD_SAMPLE, '', 'DEU'];
  for (const country_code of cases) {
    const { output_payload } = compute({ country_code });
    checked++;
    if (output_payload.inspection_rate_pct !== INSPECTION_RATES[output_payload.benchmark_risk]) violations++;
  }
  return { name: 'P2_inspection_rate_agreement', checked, violations };
}

// P3: compliance_flags baseline shape -- always-present tag, exactly one risk-tier tag, and the
// 'unknown' tier (malformed code) falls into the STANDARD flag per the kernel's own else-branch.
function checkP3_complianceFlagsShape() {
  let violations = 0, checked = 0;
  const cases = [...LOW_RISK.slice(0, 3), ...HIGH_RISK, ...STANDARD_SAMPLE, '', 'DEU'];
  for (const country_code of cases) {
    const { output_payload, compliance_flags } = compute({ country_code });
    checked++;
    if (!compliance_flags.includes('EUDR_COUNTRY_RISK_ASSESSED')) violations++;
    const tags = ['EUDR_LOW_RISK_COUNTRY', 'EUDR_HIGH_RISK_COUNTRY', 'EUDR_STANDARD_RISK_COUNTRY'].filter((t) => compliance_flags.includes(t));
    if (tags.length !== 1) violations++;
    if (output_payload.benchmark_risk === 'low' && tags[0] !== 'EUDR_LOW_RISK_COUNTRY') violations++;
    if (output_payload.benchmark_risk === 'high' && tags[0] !== 'EUDR_HIGH_RISK_COUNTRY') violations++;
    // 'standard' AND 'unknown' both fall to the else-branch STANDARD tag in the kernel.
    if ((output_payload.benchmark_risk === 'standard' || output_payload.benchmark_risk === 'unknown') && tags[0] !== 'EUDR_STANDARD_RISK_COUNTRY') violations++;
  }
  return { name: 'P3_compliance_flags_shape_unknown_falls_to_standard_tag', checked, violations };
}

// P4: due_diligence_level string agrees with the declared per-tier text.
function checkP4_dueDiligenceLevelAgreement() {
  let violations = 0, checked = 0;
  const DUE_DILIGENCE = {
    low: 'simplified — Art. 13 EUDR (risk assessment; no mitigation measures if negligible deforestation risk)',
    standard: 'full — Arts. 8-12 EUDR (supply-chain information, risk assessment, mitigation measures)',
    high: 'enhanced — Art. 14 EUDR (full due diligence + additional consultation with competent authorities)',
    unknown: 'full (default until country classified by Commission delegated act)',
  };
  const cases = [LOW_RISK[0], HIGH_RISK[0], STANDARD_SAMPLE[0], ''];
  for (const country_code of cases) {
    const { output_payload } = compute({ country_code });
    checked++;
    if (output_payload.due_diligence_level !== DUE_DILIGENCE[output_payload.benchmark_risk]) violations++;
  }
  return { name: 'P4_due_diligence_level_agreement', checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { country_code: 'DE' }, { country_code: '' }, { country_code: null }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!RISK_LEVELS.includes(output_payload.benchmark_risk)) violations++;
    if (typeof output_payload.inspection_rate_pct !== 'number' || !Number.isFinite(output_payload.inspection_rate_pct)) violations++;
    if (typeof output_payload.due_diligence_level !== 'string') violations++;
    if (findShapeViolations({ benchmark_risk: output_payload.benchmark_risk, inspection_rate_pct: output_payload.inspection_rate_pct, due_diligence_level: output_payload.due_diligence_level }).length) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_forcedCategoricalBoundaries(),
  checkP2_inspectionRateAgreement(),
  checkP3_complianceFlagsShape(),
  checkP4_dueDiligenceLevelAgreement(),
  checkP5_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
