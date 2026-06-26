import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-145-nis2-ict-supply-chain-diligence-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_nis2_supply_chain_diligence',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ENISA Art. 21(2)(d) supply-chain risk scoring.
// Each flag adds risk points; higher score = higher vendor risk.
export function compute(pp) {
  const {
    vendor_iso27001_certified = false,
    vendor_incident_history_12mo = 0,
    audit_clause_in_contract = false,
    breach_notification_sla_hours = null,
    data_residency_eu_only = false,
    sub_contractor_count = 0,
    service_availability_pct = 0,
  } = pp;

  const incidents = Number(vendor_incident_history_12mo);
  const safe_incidents = (Number.isFinite(incidents) && incidents >= 0) ? Math.floor(incidents) : 0;
  // null means "no SLA specified" — treat as a risk flag regardless of numeric value
  const sla_hours = Number(breach_notification_sla_hours);
  const sub_count = Number(sub_contractor_count);
  const safe_sub_count = (Number.isFinite(sub_count) && sub_count >= 0) ? Math.floor(sub_count) : 0;
  const avail = Number(service_availability_pct);
  const safe_avail = (Number.isFinite(avail) && avail >= 0 && avail <= 100) ? avail : 0;

  const active_risk_flags = [];
  let risk_score = 0;

  if (!vendor_iso27001_certified) { active_risk_flags.push('no_iso27001'); risk_score += 20; }
  if (safe_incidents > 0) {
    active_risk_flags.push('vendor_recent_incidents');
    risk_score += Math.min(safe_incidents * 30, 60);
  }
  if (!audit_clause_in_contract) { active_risk_flags.push('no_audit_clause'); risk_score += 25; }
  if (breach_notification_sla_hours == null || !Number.isFinite(sla_hours) || sla_hours > 72) { active_risk_flags.push('slow_breach_notification'); risk_score += 20; }
  if (!data_residency_eu_only) { active_risk_flags.push('non_eu_data_residency'); risk_score += 15; }
  if (safe_sub_count > 3) { active_risk_flags.push('unmapped_subcontractors'); risk_score += 10; }
  if (safe_avail < 99.5) { active_risk_flags.push('low_availability_sla'); risk_score += 15; }

  const risk_tier = risk_score <= 20 ? 'low' : risk_score <= 50 ? 'medium' : risk_score <= 80 ? 'high' : 'critical';
  const remediation_checklist = active_risk_flags.map(k => `remediate_${k}`);
  const total_controls = 7;
  const passed = total_controls - new Set(active_risk_flags).size;
  const enisa_control_coverage_pct = Math.round((passed / total_controls) * 100);

  const compliance_flags = { NIS2_SUPPLY_CHAIN_ASSESSED: true };
  compliance_flags[`NIS2_VENDOR_RISK_${risk_tier.toUpperCase()}`] = true;
  if (risk_tier === 'critical' || risk_tier === 'high') compliance_flags.NIS2_SUPPLY_CHAIN_REMEDIATION_REQUIRED = true;

  return {
    output_payload: {
      risk_score, risk_tier, active_risk_flags, remediation_checklist,
      enisa_control_coverage_pct,
      vendor_incident_history_12mo: safe_incidents,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
