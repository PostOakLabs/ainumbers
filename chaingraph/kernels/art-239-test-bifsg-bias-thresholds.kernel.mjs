import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-239-test-bifsg-bias-thresholds';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_bifsg_bias_thresholds',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Colorado AI Bias Test — BIFSG Insurance Proxy Thresholds ────────────────
// Implements the quantitative bias test from Colorado SB 21-169 (signed 2021-07-06)
// and Colorado Regulation 10-1-1 (effective 2023-11-14; codified by Colorado Division
// of Insurance, Market Regulation Branch).
//
// Two-pronged test applied to AGGREGATE regression outputs ONLY:
//   1. Statistical significance: p < 0.05 (marginal effect of protected class proxy)
//      Reported as p_value < 0.05 threshold; caller supplies p_value from their model
//   2. Practical significance (approval-rate or denial-rate marginal effect): >= 5pp
//      Coded as abs(marginal_effect_pct) >= 5.0 (5 percentage points)
//   3. Premium test: premium_per_1000_above_avg_pct >= 5.0% above average
//      (applies to life/health insurance pricing context)
//
// Annual attestation due December 1 each year.
// Use anchor_hash on anchor.ainumbers.co/mcp to create a timestamped anchor of
// the hashed test result — the anchor IS the attestation evidence (one anchor/yr,
// cron-free). Colorado Dec 1 deadline: anchor before Nov 30.
//
// ZERO PII by construction: inputs are AGGREGATE regression outputs (p-value,
// marginal effect percentage, premium delta). No individual applicant data,
// proxy scores, demographic identifiers, or personal information enter this kernel.
// Caller computes regression on their data; only the statistical summary is submitted.
//
// Disambiguation: test_bifsg_bias_thresholds runs the Colorado SB 21-169 / Reg 10-1-1
// BIFSG insurance-proxy + premium quantitative test. It is NOT compute_disparity_metrics
// (art-229) which applies the EEOC 4/5ths adverse-impact rule to aggregate lending
// counts in the ECOA / HMDA context — different regulation, different sector, different
// metric set.
//
// Regulatory basis:
//   Colorado SB 21-169 (2021, signed 2021-07-06)
//   Colorado Reg. 10-1-1 (effective 2023-11-14, Colorado Division of Insurance)
//   Annual attestation: December 1 each year
//   table_version: "CO-SB21169-REG10-1-1-2023"

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : (def !== undefined ? def : 0); }
function safeBool(v) { return v === true || v === 'true' || v === 1; }

// Known constants from Colorado Reg 10-1-1 (cite: Colo. Code Regs. §702-5:1-1-1 et seq.)
const P_VALUE_THRESHOLD = 0.05;          // p < 0.05 = statistically significant
const MARGINAL_EFFECT_PP_THRESHOLD = 5.0; // >= 5 percentage points
const PREMIUM_ABOVE_AVG_THRESHOLD = 5.0;  // >= 5% above average premium per $1,000 face

export function compute(pp) {
  pp = pp || {};

  // Caller supplies: aggregate model regression outputs only
  const p_value              = safeNum(pp.p_value, 1.0);           // p-value of protected proxy marginal effect
  const marginal_effect_pct  = safeNum(pp.marginal_effect_pct, 0); // marginal effect in percentage points (absolute)
  const premium_per_1000_above_avg_pct = safeNum(pp.premium_per_1000_above_avg_pct, 0); // % premium above avg per $1k face
  const test_context         = pp.test_context === 'insurance_premium' ? 'insurance_premium' : 'approval_rate';
  const model_type           = pp.model_type || 'unknown'; // e.g. 'underwriting', 'pricing', 'creditworthiness'
  const attestation_year     = Math.round(safeNum(pp.attestation_year, 0)); // e.g. 2026

  // Empty / zero guard
  const has_inputs = pp.p_value !== undefined || pp.marginal_effect_pct !== undefined;

  if (!has_inputs) {
    return {
      output_payload: {
        test_result: 'EMPTY_INPUT',
        bias_detected: false,
        p_value: 1.0,
        p_value_threshold: P_VALUE_THRESHOLD,
        p_value_significant: false,
        marginal_effect_pct: 0,
        marginal_effect_threshold_pp: MARGINAL_EFFECT_PP_THRESHOLD,
        marginal_effect_flag: false,
        premium_per_1000_above_avg_pct: 0,
        premium_threshold_pct: PREMIUM_ABOVE_AVG_THRESHOLD,
        premium_flag: false,
        remediation_required: false,
        attestation_deadline: 'December 1 each year',
        anchor_instruction: 'Anchor the test result hash at anchor.ainumbers.co/mcp using anchor_hash. The timestamp IS the annual attestation evidence.',
        pii_note: 'Inputs are AGGREGATE regression outputs only. No individual applicant data, proxy scores, demographic identifiers, or personal information. Zero PII by construction.',
        regulatory_basis: 'Colorado SB 21-169 (signed 2021-07-06); Colorado Reg. 10-1-1 (effective 2023-11-14)',
        table_version: 'CO-SB21169-REG10-1-1-2023',
      },
      compliance_flags: ['EMPTY_INPUT'],
    };
  }

  // ── Prong 1: statistical significance ─────────────────────────────────────
  const p_bounded = Math.max(0, Math.min(1, p_value));
  const p_value_significant = p_bounded < P_VALUE_THRESHOLD;

  // ── Prong 2: practical significance (marginal effect) ────────────────────
  const abs_effect = marginal_effect_pct < 0 ? -marginal_effect_pct : marginal_effect_pct;
  const marginal_effect_flag = abs_effect >= MARGINAL_EFFECT_PP_THRESHOLD;

  // ── Premium prong (life/health insurance context) ─────────────────────────
  const prem_above = premium_per_1000_above_avg_pct < 0 ? -premium_per_1000_above_avg_pct : premium_per_1000_above_avg_pct;
  const premium_flag = prem_above >= PREMIUM_ABOVE_AVG_THRESHOLD;

  // ── Bias detection: BOTH prongs must trigger ──────────────────────────────
  // Colorado SB 21-169 §3 / Reg 10-1-1: bias flag if (p < 0.05 AND effect >= 5pp)
  // OR premium >= 5% above average (premium prong is standalone)
  const approval_bias = p_value_significant && marginal_effect_flag;
  const bias_detected = approval_bias || premium_flag;

  const test_result = bias_detected ? 'BIAS_DETECTED_REMEDIATION_REQUIRED' : 'PASS';

  const do_now = [];
  if (approval_bias) {
    do_now.push('Approval-rate bias detected (p < 0.05 AND marginal effect >= 5pp). Document remediation plan per Colorado Reg. 10-1-1 §[6].');
    do_now.push('Review and update BIFSG proxy variable handling in model pipeline.');
  }
  if (premium_flag) {
    do_now.push('Premium-rate bias detected (>= 5% above average per $1,000 face). Review pricing model for protected-characteristic proxy effects.');
  }
  if (bias_detected) {
    do_now.push('Notify Colorado Division of Insurance of material bias finding per SB 21-169 §3.');
  }
  do_now.push('Anchor this test result at anchor.ainumbers.co/mcp (anchor_hash) before December 1 to constitute annual attestation evidence.');

  const compliance_flags = [];
  if (bias_detected) compliance_flags.push('COLORADO_BIAS_DETECTED');
  if (approval_bias) compliance_flags.push('APPROVAL_RATE_BIAS_FLAG');
  if (premium_flag) compliance_flags.push('PREMIUM_RATE_BIAS_FLAG');
  if (p_value_significant && !marginal_effect_flag) compliance_flags.push('STATISTICALLY_SIGNIFICANT_BELOW_PRACTICAL_THRESHOLD');

  const output_payload = {
    test_result,
    bias_detected,
    p_value: Math.round(p_bounded * 1e6) / 1e6,
    p_value_threshold: P_VALUE_THRESHOLD,
    p_value_significant,
    marginal_effect_pct: Math.round(abs_effect * 100) / 100,
    marginal_effect_threshold_pp: MARGINAL_EFFECT_PP_THRESHOLD,
    marginal_effect_flag,
    premium_per_1000_above_avg_pct: Math.round(prem_above * 100) / 100,
    premium_threshold_pct: PREMIUM_ABOVE_AVG_THRESHOLD,
    premium_flag,
    remediation_required: bias_detected,
    test_context,
    model_type: String(model_type).slice(0, 64),
    attestation_year: attestation_year || null,
    attestation_deadline: 'December 1 each year (Colorado SB 21-169 / Reg. 10-1-1)',
    do_now,
    anchor_instruction: 'Anchor the execution_hash at anchor.ainumbers.co/mcp using anchor_hash. The RFC 3161 timestamp IS the annual attestation evidence. One anchor per year, before November 30.',
    pii_note: 'Inputs are AGGREGATE regression outputs only (p-value, marginal effect %, premium delta). No individual applicant data, proxy scores, demographic identifiers, or personal information enters this kernel. Zero PII by construction.',
    regulatory_basis: 'Colorado SB 21-169 (signed 2021-07-06); Colorado Reg. 10-1-1 (effective 2023-11-14, Colorado Division of Insurance, Market Regulation Branch)',
    table_version: 'CO-SB21169-REG10-1-1-2023',
    table_source: 'Colorado SB 21-169 §3; Colorado Code of Regulations Title 3, Article 4, Part 10-1-1 (effective 2023-11-14)',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
