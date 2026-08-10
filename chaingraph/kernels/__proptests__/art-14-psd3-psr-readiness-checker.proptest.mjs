// art-14-psd3-psr-readiness-checker property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:3826069610c670c6d4dc65d677690bc66f56d815d0e4d6085fa20f0c7c59e463
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read (135 lines,
// pre-confirmed in the row text before this file was authored): 10 declared-enum fields
// (3 plain enums + 3 subset arrays, all string-valued) feeding a 6-domain weighted composite
// score, ~1e7 enum+subset-array domain per the row's estimate. No unbounded caller array. float:no
// (every input is a declared string enum or an array-of-declared-strings; no float-typed field)
// -- forced CATEGORICAL boundary cases (every enum/table value, including subset-array boundary
// members, per spec §3's float:no carve-out) stand in for ULP forcing. This floor checks
// self-consistency of the AGGREGATE (overall vs its own domain_scores, band/verdict thresholds,
// compliance-flag triggers) rather than re-deriving each d1..d6 branch -- re-deriving the
// per-domain branch arithmetic would be a second copy of the kernel's own logic, which is exactly
// what an invariant-subset floor is not meant to be. ZERO external dependencies -- pure Node
// built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-14-psd3-psr-readiness-checker.proptest.mjs

import { compute } from '../art-14-psd3-psr-readiness-checker.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-14-psd3-psr-readiness-checker';

const ENUM_DOMAIN = {
  instType: ['payment_institution', 'fintech_tpp', 'baas_platform'],
  jurisdiction: ['eu_single', 'uk_domestic'],
  psd2Status: ['fully_compliant', 'mostly_compliant', 'non_compliant'],
  openBankingLevel: ['ob_live', 'ob_testing', 'ob_none'],
  consentMaturity: ['advanced', 'standard', 'basic', 'none'],
  fraudLiability: ['zero_liability', 'shared', 'payer_bears', 'undefined'],
  baasScope: ['none', 'limited', 'moderate', 'extensive'],
};
const TPP_TYPES = ['tpp_pisp', 'tpp_aisp', 'tpp_piisp', 'tpp_none'];
const SCA_EXEMPTIONS = ['sca_low_value', 'sca_recurring', 'sca_trusted', 'sca_tra', 'sca_corp', 'sca_none'];
const OPEN_FINANCE = ['of_savings', 'of_investments', 'of_insurance', 'of_pension', 'of_mortgage', 'of_none'];
const DOMAIN_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const WEIGHTS = { d1: 0.20, d2: 0.18, d3: 0.18, d4: 0.20, d5: 0.14, d6: 0.10 };
const BANDS = ['Strong Readiness', 'Moderate Readiness', 'Partial Readiness', 'Early Stage'];

function subset(rng, arr) {
  const out = arr.filter(() => rng() < 0.4);
  return out.length ? out : [pick(rng, arr)];
}

function randomPP(rng) {
  return {
    instType: pick(rng, ENUM_DOMAIN.instType),
    jurisdiction: pick(rng, ENUM_DOMAIN.jurisdiction),
    psd2Status: pick(rng, ENUM_DOMAIN.psd2Status),
    openBankingLevel: pick(rng, ENUM_DOMAIN.openBankingLevel),
    tppTypes: subset(rng, TPP_TYPES),
    scaExemptions: subset(rng, SCA_EXEMPTIONS),
    consentMaturity: pick(rng, ENUM_DOMAIN.consentMaturity),
    openFinance: subset(rng, OPEN_FINANCE),
    fraudLiability: pick(rng, ENUM_DOMAIN.fraudLiability),
    baasScope: pick(rng, ENUM_DOMAIN.baasScope),
  };
}

// P1: overall_readiness_score is self-consistent with domain_scores under the kernel's declared
// weights, stays in [0,100], and band agrees with the declared thresholds.
function checkP1_overallSelfConsistency() {
  let violations = 0, checked = 0;
  const rng = mulberry32(14001);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const ds = output_payload.domain_scores;
    for (const k of DOMAIN_KEYS) if (typeof ds[k] !== 'number' || !Number.isFinite(ds[k])) violations++;
    const recomputed = Math.round(DOMAIN_KEYS.reduce((s, k) => s + ds[k] * WEIGHTS[k], 0));
    if (output_payload.overall_readiness_score !== recomputed) violations++;
    if (output_payload.overall_readiness_score < 0 || output_payload.overall_readiness_score > 100) violations++;
    if (!BANDS.includes(output_payload.band)) violations++;
    const s = output_payload.overall_readiness_score;
    const expectedBand = s >= 80 ? 'Strong Readiness' : s >= 60 ? 'Moderate Readiness' : s >= 40 ? 'Partial Readiness' : 'Early Stage';
    if (output_payload.band !== expectedBand) violations++;
  }
  return { name: 'P1_overall_self_consistency_random300', checked, violations };
}

// P2: verdict agrees with critical_gaps/overall per the declared threshold rule, and
// critical_gaps is exactly the count of domain_scores below 40.
function checkP2_verdictAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(14002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const ds = output_payload.domain_scores;
    const critGaps = DOMAIN_KEYS.filter((k) => ds[k] < 40).length;
    if (output_payload.critical_gaps !== critGaps) violations++;
    const overall = output_payload.overall_readiness_score;
    const expected = (critGaps >= 3 || overall < 40) ? 'High Regulatory Risk'
      : (critGaps >= 1 || overall < 65) ? 'Moderate Readiness — Targeted Gap Remediation Required'
      : 'Strong PSD3/PSR Readiness — Monitor & Maintain';
    if (output_payload.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_agreement_random300', checked, violations };
}

// P3: compliance_flags baseline shape -- always-present tags, exactly-one strong/gap tag,
// critical-gaps tag agreement, and the jurisdiction/tpp/consent-derived tags.
function checkP3_complianceFlagsShape() {
  let violations = 0, checked = 0;
  const rng = mulberry32(14003);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('PSD3_PSR_READINESS_ASSESSED')) violations++;
    if (!compliance_flags.includes('COMPLIANCE_MANDATE_ISSUED')) violations++;
    const strong = compliance_flags.includes('PSD3_STRONG_READINESS');
    const gap = compliance_flags.includes('PSD3_GAP_REMEDIATION_REQUIRED');
    if (strong === gap) violations++;
    if (strong !== (output_payload.overall_readiness_score >= 75)) violations++;
    const hasCrit = compliance_flags.includes('CRITICAL_GAPS_IDENTIFIED');
    const noCrit = compliance_flags.includes('NO_CRITICAL_GAPS');
    if (hasCrit === noCrit) violations++;
    if (hasCrit !== (output_payload.critical_gaps > 0)) violations++;
    if (pp.jurisdiction.includes('uk') && !compliance_flags.includes('UK_PSR_SCOPE')) violations++;
    if (!pp.tppTypes.includes('tpp_none') && !compliance_flags.includes('TPP_LICENSED')) violations++;
    if (!compliance_flags.includes('CONSENT_MATURITY_' + pp.consentMaturity.toUpperCase())) violations++;
  }
  return { name: 'P3_compliance_flags_shape_random300', checked, violations };
}

// P4: forced categorical boundary cases -- every declared enum value, and every subset-array
// boundary member (singleton array) and the empty-equivalent 'none' member, one dimension at a time.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const base = { instType: 'payment_institution', jurisdiction: 'eu_single', psd2Status: 'mostly_compliant', openBankingLevel: 'ob_testing', tppTypes: ['tpp_none'], scaExemptions: ['sca_none'], consentMaturity: 'standard', openFinance: ['of_none'], fraudLiability: 'shared', baasScope: 'none' };
  for (const [dim, values] of Object.entries(ENUM_DOMAIN)) {
    for (const v of values) {
      const { output_payload } = compute({ ...base, [dim]: v });
      checked++;
      if (findShapeViolations(output_payload).length) violations++;
    }
  }
  for (const v of TPP_TYPES) {
    const { output_payload } = compute({ ...base, tppTypes: [v] });
    checked++;
    if (findShapeViolations(output_payload).length) violations++;
  }
  for (const v of SCA_EXEMPTIONS) {
    const { output_payload } = compute({ ...base, scaExemptions: [v] });
    checked++;
    if (findShapeViolations(output_payload).length) violations++;
  }
  for (const v of OPEN_FINANCE) {
    const { output_payload } = compute({ ...base, openFinance: [v] });
    checked++;
    if (findShapeViolations(output_payload).length) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_enum_and_subset_values', checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { instType: 'baas_platform' }, { tppTypes: [] }, { scaExemptions: [], openFinance: [] }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length) violations++;
    if (!BANDS.includes(output_payload.band)) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_overallSelfConsistency(),
  checkP2_verdictAgreement(),
  checkP3_complianceFlagsShape(),
  checkP4_forcedCategoricalBoundaries(),
  checkP5_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
