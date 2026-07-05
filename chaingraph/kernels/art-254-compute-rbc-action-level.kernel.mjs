import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-254-compute-rbc-action-level';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// NAIC Risk-Based Capital (RBC) action level computation for US P&C and life insurers.
// Thresholds: 200%/150%/100%/70% of Authorized Control Level (ACL).
// RBC Ratio = Total Adjusted Capital (TAC) / ACL.
// ZERO PII: capital and RBC component figures only.

const TABLE_VERSION = 'NAIC-RBC-ACTION-LEVELS-2024';
const TABLE_SOURCE  = 'NAIC RBC Instructions (2024 edition): Life RBC (LR023), P&C RBC (Exhibit 1), Health RBC (HR-1). NAIC Model Laws: Life Insurance RBC Model Law #312, P&C RBC Model Law #315, Health RBC Model Law #315H.';

// Action level definitions (NAIC standard)
const ACTION_LEVELS = [
  { code: 'MANDATORY_CONTROL',  label: 'Mandatory Control Level',  rbc_pct_acl: 70,  description: 'Regulatory takeover authority. State must take action to protect policyholders.' },
  { code: 'AUTHORIZED_CONTROL', label: 'Authorized Control Level', rbc_pct_acl: 100, description: 'State authorized but not required to take control.' },
  { code: 'REGULATORY_ACTION',  label: 'Regulatory Action Level',  rbc_pct_acl: 150, description: 'Detailed corrective action plan required; state can examine/require action.' },
  { code: 'COMPANY_ACTION',     label: 'Company Action Level',     rbc_pct_acl: 200, description: 'Company must file RBC plan with comprehensive corrective strategy.' },
  { code: 'NO_ACTION',          label: 'No Action Level',          rbc_pct_acl: null, description: 'Above 200% ACL — no regulatory action required.' },
];

export function compute(params) {
  const p = params || {};

  const total_adjusted_capital = _finite(p.total_adjusted_capital, 0);   // TAC ($)
  const authorized_control_level = _finite(p.authorized_control_level, 0); // ACL ($) — from RBC formula
  const insurer_type = ['life','pc','health'].includes(p.insurer_type) ? p.insurer_type : 'pc';

  // Optional RBC component inputs for trend test (life only)
  const prior_year_rbc_ratio = _finite(p.prior_year_rbc_ratio, null); // prior year TAC/ACL %
  const two_year_rbc_ratio   = _finite(p.two_year_rbc_ratio, null);   // two years ago %

  // RBC Ratio = TAC / ACL * 100  (expressed as % of ACL)
  let rbc_ratio_pct = 0;
  if (authorized_control_level > 0) {
    rbc_ratio_pct = _round2((total_adjusted_capital / authorized_control_level) * 100);
  }

  // Determine action level
  let action_level_code = 'NO_ACTION';
  let action_level_label = 'No Action Level';
  let action_level_description = 'Above 200% ACL — no regulatory action required.';
  let threshold_breached_pct = null;

  for (const al of ACTION_LEVELS) {
    if (al.rbc_pct_acl !== null && rbc_ratio_pct < al.rbc_pct_acl) {
      action_level_code  = al.code;
      action_level_label = al.label;
      action_level_description = al.description;
      threshold_breached_pct = al.rbc_pct_acl;
      break;
    }
    if (al.code === 'COMPANY_ACTION' && rbc_ratio_pct >= 150 && rbc_ratio_pct < 200) {
      // Between 150% and 200% = COMPANY_ACTION
      action_level_code  = 'COMPANY_ACTION';
      action_level_label = 'Company Action Level';
      action_level_description = 'Company must file RBC plan with comprehensive corrective strategy.';
      threshold_breached_pct = 200;
      break;
    }
  }

  // Recalibrate: walk thresholds in descending order
  if (rbc_ratio_pct < 70) {
    action_level_code  = 'MANDATORY_CONTROL';
    action_level_label = 'Mandatory Control Level';
    action_level_description = 'Regulatory takeover authority. State must take action to protect policyholders.';
    threshold_breached_pct = 70;
  } else if (rbc_ratio_pct < 100) {
    action_level_code  = 'AUTHORIZED_CONTROL';
    action_level_label = 'Authorized Control Level';
    action_level_description = 'State authorized but not required to take control.';
    threshold_breached_pct = 100;
  } else if (rbc_ratio_pct < 150) {
    action_level_code  = 'REGULATORY_ACTION';
    action_level_label = 'Regulatory Action Level';
    action_level_description = 'Detailed corrective action plan required; state can examine and require corrective action.';
    threshold_breached_pct = 150;
  } else if (rbc_ratio_pct < 200) {
    action_level_code  = 'COMPANY_ACTION';
    action_level_label = 'Company Action Level';
    action_level_description = 'Company must file RBC plan with comprehensive corrective strategy.';
    threshold_breached_pct = 200;
  } else {
    action_level_code  = 'NO_ACTION';
    action_level_label = 'No Action Level';
    action_level_description = 'Above 200% ACL — no NAIC regulatory action required.';
    threshold_breached_pct = null;
  }

  // Trend test (life insurer §VI, P&C similar): if RBC ratio decreased by >= 10 ppt each of last 2 years
  // AND current ratio < 250%, flag trend test concern
  let trend_test_triggered = false;
  let trend_test_applicable = prior_year_rbc_ratio !== null && two_year_rbc_ratio !== null;
  if (trend_test_applicable) {
    const drop1 = two_year_rbc_ratio   - prior_year_rbc_ratio; // drop in year n-2 → n-1
    const drop2 = prior_year_rbc_ratio - rbc_ratio_pct;        // drop in year n-1 → n
    trend_test_triggered =
      drop1 >= 10 && drop2 >= 10 && rbc_ratio_pct < 250;
  }

  // Capital cushion to next threshold
  let headroom_to_next_level_pct = null;
  const next_threshold_map = {
    'MANDATORY_CONTROL':  70,
    'AUTHORIZED_CONTROL': 100,
    'REGULATORY_ACTION':  150,
    'COMPANY_ACTION':     200,
    'NO_ACTION':          null,
  };
  const next_t = next_threshold_map[action_level_code];
  if (next_t !== null) {
    headroom_to_next_level_pct = _round2(rbc_ratio_pct - (
      action_level_code === 'MANDATORY_CONTROL'  ? 0   :
      action_level_code === 'AUTHORIZED_CONTROL' ? 70  :
      action_level_code === 'REGULATORY_ACTION'  ? 100 :
      action_level_code === 'COMPANY_ACTION'     ? 150 : 200
    ));
  } else {
    headroom_to_next_level_pct = _round2(rbc_ratio_pct - 200);
  }

  return {
    action_level_code,
    action_level_label,
    action_level_description,
    rbc_ratio_pct,
    total_adjusted_capital,
    authorized_control_level,
    threshold_breached_pct,
    headroom_to_next_level_pct,
    trend_test_triggered,
    trend_test_applicable,
    prior_year_rbc_ratio,
    two_year_rbc_ratio,
    insurer_type,
    action_levels_reference: ACTION_LEVELS,
    table_version:   TABLE_VERSION,
    table_source:    TABLE_SOURCE,
    regulatory_basis:'NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health). Action levels: Company Action (200% ACL), Regulatory Action (150%), Authorized Control (100%), Mandatory Control (70%). TAC/ACL calculation follows the applicable NAIC RBC formula for the insurer type.',
    pii_note:        'ZERO PII: capital totals and RBC formula components only. No policyholder, premium, or personal data enters this kernel.',
    not_legal_advice:'Not legal or actuarial advice. RBC calculations require review by a qualified actuary and the applicable state insurance department. NAIC RBC Ratio is not the sole indicator of insurer solvency.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
