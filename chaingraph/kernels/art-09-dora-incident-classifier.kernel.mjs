// art-09 — DORA Major-Incident Reporting Threshold Classifier: pure decision kernel.
// Faithful port of runClassification() in
//   repo/chaingraph/art-09-dora-incident-classifier.html
// Pure: no DOM, no window, no network.
// DORA (EU) 2022/2554 Art. 23 · ESA Joint RTS EBA/RTS/2023/11.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-09-dora-incident-classifier';
const TOOL_VERSION = '1.0.0';

// ESA Joint RTS thresholds — EBA/RTS/2023/11
const THRESHOLDS = {
  clients_pct_min:                     10,   // ≥10% of total clients
  clients_abs_min:                 100000,   // OR ≥100,000 clients
  duration_critical_fn_minutes:       120,   // 2h — critical/important function
  duration_payment_minutes:            30,   // 30 min — payment services
  duration_other_minutes:             240,   // 4h — other functions
  tx_value_eur_millions_payment:       10,   // €10M for payment/credit institutions
  tx_value_eur_millions_other:         50,   // €50M for other entity types
  geographic_member_states_min:         2,   // ≥2 member states
};

const PAYMENT_ENTITY_TYPES = new Set(['payment_institution', 'credit_institution']);

/**
 * compute(pp) — pure DORA major-incident classification engine.
 * pp: {
 *   incident_type?:         'ict_outage' | 'cyber_attack' | 'data_breach' | 'third_party_failure' | 'other',
 *   entity_type?:           'credit_institution' | 'payment_institution' | 'investment_firm' | 'insurance' | 'crypto_asset' | 'other',
 *   detection_dt?:          string,   // ISO 8601 datetime — classification clock reference
 *   classification_dt?:     string,   // ISO 8601 datetime — 4h initial notification starts here
 *   resolution_dt?:         string,   // ISO 8601 datetime — final report 30d from here
 *   clients_affected?:      number,   // clients / counterparties / transactions at risk
 *   total_clients?:         number,   // total client base (required for % calc)
 *   tx_value_eur?:          number,   // transaction value in EUR millions; 0 = not applicable
 *   outage_duration_mins?:  number,   // service disruption minutes; 0 = no outage
 *   member_states?:         number,   // EU member states affected (1–27)
 *   data_loss?:             boolean,  // confidentiality/integrity/availability breach
 *   critical_fn?:           boolean,  // critical or important function affected
 *   cross_border?:          boolean,  // cross-border operations across ≥2 member states
 *   tp_ict?:                boolean,  // third-party ICT provider involved
 * }
 */
export function compute(pp) {
  const entityType       = pp.entity_type ?? 'other';
  const incidentType     = pp.incident_type ?? 'other';
  const clientsAffected  = Number(pp.clients_affected ?? 0);
  const totalClients     = Number(pp.total_clients ?? 1);
  const txValueEur       = Number(pp.tx_value_eur ?? 0);
  const outageMins       = Number(pp.outage_duration_mins ?? 0);
  const memberStates     = Number(pp.member_states ?? 1);
  const dataLoss         = pp.data_loss === true;
  const criticalFn       = pp.critical_fn === true;
  const crossBorder      = pp.cross_border === true;
  const tpIct            = pp.tp_ict === true;

  const isPayment = PAYMENT_ENTITY_TYPES.has(entityType);
  const clientPct = totalClients > 0 ? (clientsAffected / totalClients) * 100 : 0;
  const durationThreshold = criticalFn ? THRESHOLDS.duration_critical_fn_minutes
    : isPayment ? THRESHOLDS.duration_payment_minutes : THRESHOLDS.duration_other_minutes;
  const txThreshold = isPayment ? THRESHOLDS.tx_value_eur_millions_payment : THRESHOLDS.tx_value_eur_millions_other;

  // Six criteria — each with met/not_assessed/value/article
  const criteria = [
    {
      id: 'critical_fn',
      label: 'Critical/important function affected',
      met: criticalFn,
      not_assessed: false,
      value: criticalFn ? 'Yes' : 'No',
      article: 'DORA Art. 23(1)(a) / ESA RTS Art. 3',
    },
    {
      id: 'clients',
      label: `Clients affected (≥${THRESHOLDS.clients_pct_min}% or ≥${THRESHOLDS.clients_abs_min.toLocaleString()})`,
      met: clientPct >= THRESHOLDS.clients_pct_min || clientsAffected >= THRESHOLDS.clients_abs_min,
      not_assessed: clientsAffected === 0 && totalClients <= 1,
      value: `${clientsAffected.toLocaleString()} (${clientPct.toFixed(1)}%)`,
      article: 'DORA Art. 23(1)(b) / ESA RTS Art. 4',
    },
    {
      id: 'data_loss',
      label: 'Data loss / confidentiality breach',
      met: dataLoss,
      not_assessed: false,
      value: dataLoss ? 'Yes' : 'No',
      article: 'DORA Art. 23(1)(c) / ESA RTS Art. 5',
    },
    {
      id: 'tx_value',
      label: `Transaction value ≥ €${txThreshold}M`,
      met: txValueEur > 0 && txValueEur >= txThreshold,
      not_assessed: txValueEur === 0,
      value: txValueEur > 0 ? `€${txValueEur}M` : 'Not applicable',
      article: 'DORA Art. 23(1)(d) / ESA RTS Art. 6',
    },
    {
      id: 'duration',
      label: `Outage ≥ ${durationThreshold} min (${criticalFn ? 'critical fn' : isPayment ? 'payment' : 'other'})`,
      met: outageMins > 0 && outageMins >= durationThreshold,
      not_assessed: outageMins === 0,
      value: outageMins > 0 ? `${outageMins} min` : 'Not applicable',
      article: 'DORA Art. 23(1)(e) / ESA RTS Art. 7',
    },
    {
      id: 'geographic',
      label: `Geographic spread ≥ ${THRESHOLDS.geographic_member_states_min} EU member states`,
      met: memberStates >= THRESHOLDS.geographic_member_states_min,
      not_assessed: memberStates < 1,
      value: `${memberStates} member state${memberStates !== 1 ? 's' : ''}`,
      article: 'DORA Art. 23(1)(f) / ESA RTS Art. 8',
    },
  ];

  const isMajor = criteria.some(c => !c.not_assessed && c.met);
  const qualifyingCriteria = criteria.filter(c => !c.not_assessed && c.met).map(c => c.id);

  // Reporting clock (UTC timestamps or null when dates not provided)
  const detectionMs = pp.detection_dt ? new Date(pp.detection_dt).getTime() : null;
  const classificationMs = pp.classification_dt ? new Date(pp.classification_dt).getTime()
    : detectionMs;
  const resolutionMs = pp.resolution_dt ? new Date(pp.resolution_dt).getTime() : null;

  let reporting_clock = null;
  if (classificationMs) {
    const initialMs = Math.min(
      classificationMs + 4 * 60 * 60 * 1000,
      detectionMs ? detectionMs + 24 * 60 * 60 * 1000 : classificationMs + 4 * 60 * 60 * 1000,
    );
    const intermediateMs = initialMs + 72 * 60 * 60 * 1000;
    const finalMs = resolutionMs ? resolutionMs + 30 * 24 * 60 * 60 * 1000 : null;
    reporting_clock = {
      detection_datetime:              detectionMs ? new Date(detectionMs).toISOString() : null,
      classification_datetime:         new Date(classificationMs).toISOString(),
      initial_notification_deadline:   new Date(initialMs).toISOString(),
      intermediate_report_deadline:    new Date(intermediateMs).toISOString(),
      final_report_deadline:           finalMs ? new Date(finalMs).toISOString() : null,
    };
  }

  const output_payload = {
    major_incident:      isMajor,
    determination_code:  isMajor ? 'MAJOR' : 'NON_MAJOR',
    qualifying_criteria: qualifyingCriteria,
    criteria_detail:     criteria.map(c => ({ id: c.id, met: c.met, not_assessed: c.not_assessed, value: c.value, article: c.article })),
    reporting_clock,
    entity_type:         entityType,
    incident_type:       incidentType,
    cross_border:        crossBorder,
    third_party_ict:     tpIct,
    competent_authority_note: 'Report to your national competent authority (NCA) per DORA Art. 19. Cross-border incidents require coordination per Art. 19(6).',
    regulatory_framework: 'DORA (EU) 2022/2554 Art. 23 · ESA Joint RTS EBA/RTS/2023/11 (published January 2025)',
  };

  const compliance_flags = isMajor
    ? ['DORA_MAJOR_INCIDENT', 'REPORTING_OBLIGATION_TRIGGERED']
    : ['DORA_NON_MAJOR'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'infrastructure_mandate',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'infrastructure_mandate' };
