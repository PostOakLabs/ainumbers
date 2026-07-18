// art-374 — NAV-error materiality tester: pure decision kernel.
//
// FN-2, second entry of the Funds/NAV family (FUNDS-NAV-BUILD-SPEC.md), rides
// FN-1 (art-373 recompute_fund_nav)'s fixed-point conventions. Compares an
// erroneous NAV-per-share against a corrected NAV-per-share against a DECLARED
// materiality policy — the industry half-cent and 1% conventions, PLUS the
// fund's own policy taken as an input, either of which may override the
// industry defaults — and returns a material/immaterial verdict, affected-
// period math, and a reprocessing-need indication. The fund-ops incident
// artifact. Fixed-point (BigInt) money math throughout, mirroring art-373.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the
// erroneous and corrected NAV-per-share values here are SUPPLIED by the
// caller and merely ASSERTED — this kernel performs zero independent NAV
// recomputation (that is art-373's job) and zero market-data lookups
// (zero-egress by contract, no network calls of any kind). It attests the
// ARITHMETIC of the error comparison against a DECLARED policy. This is
// NEVER an accounting opinion, NEVER a determination that a fund must
// reprocess, and NEVER advice — it computes what the declared policy
// implies, nothing more.
//
// Fixed-point design: identical SCALE_EXP/BigInt approach to art-373 — every
// money value parsed from its decimal string representation, never via
// floating multiplication. The half-cent / 1% industry conventions are
// informative defaults, not a codified SEC/40-Act materiality rule.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-374-test-nav-error-materiality';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'test_nav_error_materiality',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) — mirrors art-373 exactly ────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

function toFixed(value) {
  let s = String(value ?? 0).trim();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
  let [intPart, fracPart = ''] = s.split('.');
  if (intPart === '') intPart = '0';
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP); // truncate excess precision, never round up
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}

function mulFixed(a, b) {
  return (a * b) / SCALE;
}

function divFixed(a, b) {
  if (b === 0n) return 0n;
  return (a * SCALE) / b;
}

function absFixed(a) {
  return a < 0n ? -a : a;
}

// Renders a SCALE-scaled BigInt back to a decimal string, truncating (never
// rounding) — used for reported figures so nothing silently drifts.
function fixedToPlainString(value, places) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  const q = abs / divisor;
  let qs = q.toString();
  let result;
  if (places === 0) {
    result = qs;
  } else {
    qs = qs.padStart(places + 1, '0');
    result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
  }
  return (neg && q !== 0n) ? `-${result}` : result;
}

// Industry-convention defaults (informative, not a codified regulatory rule):
// half-cent absolute per-share threshold, 1% relative-to-corrected-NAV threshold.
const INDUSTRY_ABSOLUTE_THRESHOLD = '0.005';
const INDUSTRY_PERCENT_THRESHOLD = '1';

const NOT_PROVEN = [
  { item: 'Accounting opinion', detail: 'This kernel computes what the DECLARED materiality policy implies over the supplied error figures. It is never an accounting opinion, never a legal or regulatory determination of materiality.' },
  { item: 'Reprocessing decision authority', detail: 'A material-verdict flag indicates a reprocessing REVIEW is warranted per the declared policy. The decision to reprocess, and how, rests with the fund’s accounting/compliance function, never this kernel.' },
  { item: 'NAV accuracy of underlying inputs', detail: 'The erroneous and corrected NAV-per-share values are caller-supplied and asserted, not independently recomputed or verified here (see recompute_fund_nav, art-373, for that arithmetic).' },
  { item: 'Regulatory materiality standard', detail: 'The half-cent and 1% figures are common industry conventions, not a codified SEC/40-Act materiality rule. This kernel makes no compliance claim under either framework.' },
];

/**
 * compute(pp) — pure NAV-error-materiality kernel.
 * pp: {
 *   fund_id?: string,
 *   valuation_date?: string,
 *   erroneous_nav_per_share: number|string,
 *   corrected_nav_per_share: number|string,
 *   materiality_policy?: {
 *     absolute_threshold?: number|string,  // default '0.005' (industry half-cent)
 *     percent_threshold?: number|string,   // default '1' (industry 1%)
 *     policy_source?: string,              // e.g. 'fund_declared' | 'industry_default'
 *   },
 *   affected_period?: { start_date?: string, end_date?: string, days?: number|string },
 *   shares_outstanding?: number|string,    // for affected-period impact estimate
 * }
 */
export function compute(pp) {
  pp = pp ?? {};
  const fundId = pp.fund_id ?? null;
  const valuationDate = pp.valuation_date ?? null;

  const erroneousFixed = toFixed(pp.erroneous_nav_per_share);
  const correctedFixed = toFixed(pp.corrected_nav_per_share);

  const policy = pp.materiality_policy ?? {};
  const absoluteThresholdRaw = policy.absolute_threshold ?? INDUSTRY_ABSOLUTE_THRESHOLD;
  const percentThresholdRaw = policy.percent_threshold ?? INDUSTRY_PERCENT_THRESHOLD;
  const policySource = policy.policy_source ?? ((policy.absolute_threshold != null || policy.percent_threshold != null) ? 'fund_declared' : 'industry_default');
  const absoluteThresholdFixed = toFixed(absoluteThresholdRaw);
  const percentThresholdFixed = toFixed(percentThresholdRaw);

  let structuralError = null;
  if (correctedFixed === 0n) structuralError = 'corrected_nav_per_share must be non-zero to compute a relative error.';

  const errorFixed = erroneousFixed - correctedFixed;
  const absErrorFixed = absFixed(errorFixed);
  const errorDirection = errorFixed > 0n ? 'overstated' : (errorFixed < 0n ? 'understated' : 'none');

  // error_pct = |error| / |corrected| * 100, in the same SCALE domain
  const errorPctFixed = structuralError ? 0n : mulFixed(divFixed(absErrorFixed, absFixed(correctedFixed)), toFixed(100));

  // Industry-convention checks (fixed constants, always reported for reference).
  const industryAbsoluteFixed = toFixed(INDUSTRY_ABSOLUTE_THRESHOLD);
  const industryPercentFixed = toFixed(INDUSTRY_PERCENT_THRESHOLD);
  const industryAbsoluteBreach = absErrorFixed >= industryAbsoluteFixed;
  const industryPercentBreach = errorPctFixed >= industryPercentFixed;
  const industryMaterial = industryAbsoluteBreach || industryPercentBreach;

  // Declared-policy checks (may equal industry defaults if not overridden).
  const policyAbsoluteBreach = absErrorFixed >= absoluteThresholdFixed;
  const policyPercentBreach = errorPctFixed >= percentThresholdFixed;
  const policyMaterial = !structuralError && (policyAbsoluteBreach || policyPercentBreach);

  const materialityVerdict = structuralError ? 'INDETERMINATE' : (policyMaterial ? 'MATERIAL' : 'IMMATERIAL');

  // ── affected-period math (declared inputs only, asserted) ──────────────────
  const period = pp.affected_period ?? {};
  const affectedDays = period.days != null ? Number(period.days) : null;
  const sharesOutstandingFixed = pp.shares_outstanding != null ? toFixed(pp.shares_outstanding) : null;
  const estimatedImpactFixed = (policyMaterial && sharesOutstandingFixed != null) ? mulFixed(absErrorFixed, sharesOutstandingFixed) : null;

  const reprocessingNeedIndicated = policyMaterial;

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('NAV_ERROR_STRUCTURAL_ERROR');
  else compliance_flags.push(policyMaterial ? 'NAV_ERROR_MATERIAL' : 'NAV_ERROR_IMMATERIAL');
  if (errorDirection === 'overstated') compliance_flags.push('NAV_ERROR_OVERSTATED');
  else if (errorDirection === 'understated') compliance_flags.push('NAV_ERROR_UNDERSTATED');
  if (reprocessingNeedIndicated) compliance_flags.push('REPROCESSING_REVIEW_INDICATED');
  if (!structuralError && industryMaterial !== policyMaterial) compliance_flags.push('NAV_ERROR_POLICY_DIVERGES_FROM_INDUSTRY_DEFAULT');
  compliance_flags.push('NAV_ERROR_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    fund_id: fundId,
    valuation_date: valuationDate,
    structural_error: structuralError,
    error: {
      erroneous_nav_per_share: fixedToPlainString(erroneousFixed, SCALE_EXP),
      corrected_nav_per_share: fixedToPlainString(correctedFixed, SCALE_EXP),
      error_amount: fixedToPlainString(errorFixed, SCALE_EXP),
      error_amount_abs: fixedToPlainString(absErrorFixed, SCALE_EXP),
      error_direction: errorDirection,
      error_pct_abs: structuralError ? null : fixedToPlainString(errorPctFixed, 6),
    },
    industry_convention: {
      absolute_threshold: INDUSTRY_ABSOLUTE_THRESHOLD,
      percent_threshold: INDUSTRY_PERCENT_THRESHOLD,
      absolute_breach: industryAbsoluteBreach,
      percent_breach: industryPercentBreach,
      material: industryMaterial,
    },
    declared_policy: {
      absolute_threshold: fixedToPlainString(absoluteThresholdFixed, SCALE_EXP),
      percent_threshold: fixedToPlainString(percentThresholdFixed, 6),
      policy_source: policySource,
      absolute_breach: policyAbsoluteBreach,
      percent_breach: policyPercentBreach,
      material: policyMaterial,
    },
    materiality_verdict: materialityVerdict,
    affected_period: {
      start_date: period.start_date ?? null,
      end_date: period.end_date ?? null,
      days: affectedDays,
    },
    shares_outstanding: sharesOutstandingFixed != null ? fixedToPlainString(sharesOutstandingFixed, SCALE_EXP) : null,
    estimated_impact: estimatedImpactFixed != null ? fixedToPlainString(estimatedImpactFixed, SCALE_EXP) : null,
    reprocessing_need_indicated: reprocessingNeedIndicated,
    not_proven: NOT_PROVEN,
    fence: 'The erroneous and corrected NAV-per-share values are SUPPLIED, asserted, and digested into this receipt. This kernel attests the ARITHMETIC of the error comparison against a DECLARED materiality policy — never an accounting opinion, never a determination that a fund must reprocess, never advice. It computes what the declared policy implies.',
    regulatory_framework: 'Industry half-cent / 1% NAV-error materiality conventions referenced as informative context only; this kernel makes no compliance claim under any specific regulatory framework.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
