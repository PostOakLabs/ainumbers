import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-219-qm-apr-apor-spread';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_qm_apr_apor_spread',
  mandate_type: 'compliance_mandate', gpu: false,
};

// QM APR-APOR spread test per Reg Z §1026.43(e)(2)(vi) and §1026.43(b)(4).
// Determines General QM pass/fail AND safe-harbor vs rebuttable-presumption status.
//
// Spread thresholds (version-pinned — same structure applies from 2014 rule onward):
//   First-lien loans >= $137,958 (2026 threshold): spread must be < 2.25 pp
//   First-lien loans < $137,958 (small loan): spread must be < 3.5 pp
//   First-lien manufactured housing loans: spread must be < 6.5 pp
//   Subordinate-lien loans: spread must be < 3.5 pp
//
// Safe-harbor vs rebuttable-presumption (HPCT) cutoff: 1.5 pp above APOR for first liens.
// A loan is HPCT (Higher-Priced Covered Transaction) if APR > APOR + 1.5 pp (first lien).
// HPCT loans that pass QM get rebuttable-presumption status; non-HPCT get safe harbor.
//
// APOR is an INPUT. Caller must supply it from the FFIEC weekly APOR table.
// This node does NOT bundle APOR data -- APOR changes weekly, version-pinning would rot.

// Spread thresholds table (version-pinned, rule-of-law values, not index-adjusted)
const SPREAD_THRESHOLDS = {
  first_lien_standard: {
    loan_size_cutoff: 137958, // 2026 threshold (§1026.43(e)(2)(vi)(A))
    below_cutoff_spread: 3.5,
    above_cutoff_spread: 2.25,
    manufactured_housing_spread: 6.5,
    fr_citation: 'Reg Z §1026.43(e)(2)(vi)(A)-(C); Dodd-Frank Act §1412; CFPB QM Rule Jan 2021; CFPB 2021 General QM Final Rule (FR 2020-28417)',
  },
  subordinate_lien: {
    spread: 3.5,
    fr_citation: 'Reg Z §1026.43(e)(2)(vi)(B)',
  },
};

// HPCT thresholds per §1026.43(b)(4) / Regulation Z
const HPCT_THRESHOLD_FIRST_LIEN = 1.5; // pp above APOR
const HPCT_THRESHOLD_SUB_LIEN = 3.5;   // pp above APOR

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const apr_pct = safeNum(pp.apr_pct, 0);
  const apor_pct = safeNum(pp.apor_pct, 0);
  const lien_type = pp.lien_type === 'subordinate' ? 'subordinate' : 'first';
  const is_manufactured = Boolean(pp.is_manufactured_housing);
  const loan_amount = safeNum(pp.loan_amount, 0);
  const year = Math.round(safeNum(pp.year, 2026));

  const spread = r4(apr_pct - apor_pct);

  // Determine applicable threshold
  let applicable_threshold, threshold_basis;
  if (lien_type === 'subordinate') {
    applicable_threshold = SPREAD_THRESHOLDS.subordinate_lien.spread;
    threshold_basis = 'subordinate_lien_3.5pp';
  } else if (is_manufactured) {
    applicable_threshold = SPREAD_THRESHOLDS.first_lien_standard.manufactured_housing_spread;
    threshold_basis = 'manufactured_housing_first_lien_6.5pp';
  } else {
    // Size-based threshold for standard first-lien
    const cutoff = SPREAD_THRESHOLDS.first_lien_standard.loan_size_cutoff;
    if (loan_amount >= cutoff) {
      applicable_threshold = SPREAD_THRESHOLDS.first_lien_standard.above_cutoff_spread;
      threshold_basis = 'first_lien_standard_2.25pp';
    } else {
      applicable_threshold = SPREAD_THRESHOLDS.first_lien_standard.below_cutoff_spread;
      threshold_basis = 'first_lien_small_loan_3.5pp';
    }
  }

  const general_qm_pass = spread < applicable_threshold - 1e-5; // strict less-than, floating-point margin

  // HPCT determination (Higher-Priced Covered Transaction)
  const hpct_threshold = lien_type === 'subordinate' ? HPCT_THRESHOLD_SUB_LIEN : HPCT_THRESHOLD_FIRST_LIEN;
  const is_hpct = spread >= hpct_threshold - 1e-5;

  // QM status determination
  let qm_status;
  if (!general_qm_pass) {
    qm_status = 'general_qm_fail';
  } else if (is_hpct) {
    qm_status = 'general_qm_rebuttable_presumption'; // passes QM but HPCT = rebuttable presumption
  } else {
    qm_status = 'general_qm_safe_harbor'; // passes QM and below HPCT = safe harbor
  }

  const headroom = r4(applicable_threshold - spread);

  const compliance_flags = [];
  if (!general_qm_pass) compliance_flags.push('QM_APR_SPREAD_FAIL');
  if (is_hpct) compliance_flags.push('HPCT_LOAN');
  if (qm_status === 'general_qm_rebuttable_presumption') compliance_flags.push('QM_REBUTTABLE_PRESUMPTION');

  const output_payload = {
    qm_status,
    general_qm_pass,
    is_hpct,
    spread_pct: spread,
    apr_pct: r4(apr_pct),
    apor_pct: r4(apor_pct),
    lien_type,
    is_manufactured_housing: is_manufactured,
    loan_amount: r2(loan_amount),
    year,
    applicable_threshold_pct: applicable_threshold,
    threshold_basis,
    hpct_threshold_pct: hpct_threshold,
    headroom_pct: headroom,
    fr_citation: lien_type === 'subordinate'
      ? SPREAD_THRESHOLDS.subordinate_lien.fr_citation
      : SPREAD_THRESHOLDS.first_lien_standard.fr_citation,
    regulatory_basis: 'Reg Z §1026.43(e)(2)(vi) (QM spread test) and §1026.43(b)(4) (HPCT safe-harbor vs rebuttable presumption)',
    note: 'APOR must be supplied by caller from FFIEC weekly APOR table (ffiec.gov/ratespread). This node does not bundle APOR data. 2026 loan-size cutoff $137,958 per FR 2025-22773.',
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
