import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-144-nis2-incident-significance-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_nis2_incident_significance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NIS2 Art. 23: significant incident = any one of the listed criteria met.
// Conservative thresholds per ENISA guidance and member-state implementations.
const SIGNIFICANCE_THRESHOLDS = {
  service_disruption_hours_min: 1,
  affected_users_min: 1000,
  financial_loss_eur_min: 100_000,
};

export function compute(pp) {
  const {
    service_disruption_hours = 0,
    estimated_affected_users = 0,
    estimated_financial_loss_eur = 0,
    third_party_cascade_impact = false,
    involves_malicious_act = false,
    cross_border_impact = false,
    entity_classification = '',
  } = pp;

  const disruption = Number(service_disruption_hours);
  const users = Number(estimated_affected_users);
  const loss = Number(estimated_financial_loss_eur);
  const safe_disruption = (Number.isFinite(disruption) && disruption >= 0) ? disruption : 0;
  const safe_users = (Number.isFinite(users) && users >= 0) ? Math.floor(users) : 0;
  const safe_loss = (Number.isFinite(loss) && loss >= 0) ? loss : 0;

  const triggering_factors = [];
  if (safe_disruption >= SIGNIFICANCE_THRESHOLDS.service_disruption_hours_min) triggering_factors.push('service_disruption');
  if (safe_users >= SIGNIFICANCE_THRESHOLDS.affected_users_min) triggering_factors.push('significant_user_impact');
  if (safe_loss >= SIGNIFICANCE_THRESHOLDS.financial_loss_eur_min) triggering_factors.push('considerable_financial_loss');
  if (third_party_cascade_impact) triggering_factors.push('third_party_cascade');
  if (involves_malicious_act) triggering_factors.push('malicious_act');
  if (cross_border_impact) triggering_factors.push('cross_border_impact');

  const reporting_required = triggering_factors.length > 0;
  const is_critical = triggering_factors.length >= 3 || (third_party_cascade_impact && involves_malicious_act) || safe_loss >= 1_000_000;
  const significance_verdict = !reporting_required ? 'not_significant' : is_critical ? 'critical' : 'significant';

  const recipients = [];
  if (reporting_required) {
    recipients.push('national_csirt');
    recipients.push('supervisory_authority');
    if (entity_classification === 'essential') recipients.push('sector_regulator');
  }

  const compliance_flags = { NIS2_INCIDENT_ASSESSED: true };
  if (reporting_required) compliance_flags.NIS2_SIGNIFICANT_INCIDENT = true;
  if (is_critical) compliance_flags.NIS2_CRITICAL_INCIDENT = true;
  if (cross_border_impact) compliance_flags.NIS2_CROSS_BORDER_IMPACT = true;
  if (!reporting_required) compliance_flags.NIS2_INCIDENT_BELOW_THRESHOLD = true;

  return {
    output_payload: {
      significance_verdict, triggering_factors, reporting_required,
      early_warning_deadline_hours: reporting_required ? 24 : null,
      notification_deadline_hours: reporting_required ? 72 : null,
      final_report_deadline_days: reporting_required ? 30 : null,
      recipients,
      service_disruption_hours: safe_disruption,
      estimated_affected_users: safe_users,
      estimated_financial_loss_eur: safe_loss,
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
