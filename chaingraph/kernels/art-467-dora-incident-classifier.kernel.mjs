/**
 * art-467-dora-incident-classifier.kernel.mjs
 * Assurance Waves program (DORA-ROI-BUILD-SPEC.md §1, DORA-K-1) — DORA major-ICT-incident
 * classification thresholds + reporting-clock deadlines.
 *
 * DORA (EU) 2022/2554 Art. 18 sets the classification criteria for major ICT-related incidents
 * (clients/counterparties affected, duration, geographical spread, data losses, economic impact,
 * criticality of services affected, reputational impact). The numeric materiality thresholds for
 * each criterion are set out in the ESAs' final RTS on classification of major incidents and
 * significant cyber threats — Commission Delegated Regulation (EU) 2024/1772 of 13 Mar 2024
 * (based on DORA Art. 18(3)). Reporting timelines (initial notification, intermediate report,
 * final report, DORA Art. 19) are set out in the companion RTS/ITS on incident-reporting content
 * and timelines (Commission Implementing Regulation (EU) 2025/302, ITS on standard forms/
 * templates and timelines for the report on major ICT-related incidents).
 *
 * TABLE VERSION / CITATION CONFIDENCE (documented, not silently assumed — STP-WAVE-COMPLIANCE-
 * RIDERS.md §3 convention): the numeric thresholds below (10% clients, 24h duration, 2 member
 * states, EUR 100,000 economic impact) and the reporting-clock hour figures (4h initial / 72h
 * intermediate / 1 calendar month final, all clocked from classification) are pinned to the
 * commonly-cited headline figures from the 2024 RTS/ITS package as understood at kernel-build
 * time (2026-07-24). They are MODERATE, not certified, confidence — the RTS combines several
 * criteria with per-criterion nuance (e.g. the clients-affected test also has an absolute-count
 * limb, the economic-impact test has a relative-to-Tier-1-capital limb for some entity types)
 * that this kernel does NOT model. table_version below records the pin; a legal/compliance
 * review MUST verify these figures against the final consolidated RTS/ITS text before this
 * kernel's verdict is relied on for an actual regulatory filing. This kernel classifies and
 * computes deadlines; it does not itself transmit, file, or submit any regulatory notification,
 * and it is not legal advice.
 *
 * NEAR-COLLISION DISAMBIGUATION (found during DORA-K-1 build, 2026-07-24): a DORA incident
 * classifier already ships as art-09-dora-incident-classifier.kernel.mjs (wave 1,
 * mcp_name `classify_dora_incident`, mandate_type `infrastructure_mandate`, citing the EARLIER
 * draft ESA Joint RTS EBA/RTS/2023/11, no §18 conformance fixtures, not linked to any
 * notification-clock sibling). art-467 is NOT a straight duplicate build, but the overlap is
 * real and is flagged to the calling session for review: art-467 (a) cites the FINAL 2024
 * RTS/ITS package rather than the 2023 draft, (b) is built to the Banking OCG program's mature
 * attestation-clock pattern (art-428-style: `attestation_mandate`, conformance_fixtures:true,
 * bidirectional link to a notification-clock sibling), and (c) is scoped as a companion to
 * art-466's Register-of-Information builder inside the Assurance Waves program rather than a
 * standalone wave-1 tool. Do NOT build a THIRD DORA incident classifier without first resolving
 * whether art-09 and art-467 should be consolidated or clearly re-scoped against each other.
 *
 * See art-428-cyber-incident-clock.kernel.mjs for the analogous US banking/SEC/NYDFS
 * notification-clock pattern this kernel follows for the EU DORA regime (calendar-hour
 * deadlines computed deterministically in UTC from one caller-declared classification
 * timestamp, plus a decision-tree attestation slot per report). art-428 carries a matching
 * forward-pointing note to this kernel.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (all timestamps are
 * caller-declared policy_parameters).
 *
 * Spec: DORA-ROI-BUILD-SPEC.md §1 (DORA-K-1, art-467).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-467-dora-incident-classifier';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_dora_ict_incident_and_clock_deadlines', mandate_type: 'attestation_mandate', gpu: false };

const HOUR_MS = 3600 * 1000;

const TABLE_VERSION = 'DORA-RTS-2024-1772-CLASSIFICATION+ITS-2025-302-TIMELINES-2026-07';
const TABLE_SOURCE = 'DORA (EU) 2022/2554 Art. 18 (classification criteria) + Art. 19 (reporting obligations/timelines); Commission Delegated Regulation (EU) 2024/1772 (RTS on classification criteria for major ICT-related incidents and significant cyber threats); Commission Implementing Regulation (EU) 2025/302 (ITS on standard forms/templates and timelines for major-incident reports). Numeric thresholds pinned at MODERATE confidence -- verify against final consolidated RTS/ITS text at legal review before relying on this verdict for an actual filing.';

const THRESHOLDS = {
  clients_affected_pct_min: 10, // >=10% of registered clients/users/counterparties affected
  duration_minutes_min: 24 * 60, // 24 hours of service disruption
  geographical_spread_countries_min: 2, // >=2 EU member states affected
  economic_impact_eur_min: 100000, // EUR 100,000 absolute materiality threshold
};

// Deterministic UTC parse -- returns ms since epoch or null.
function parseIsoOrNull(s) {
  if (s == null || s === '') return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
function isoOrNull(ms) { return ms == null ? null : new Date(ms).toISOString(); }

// Adds one CALENDAR month (UTC), clamping the day-of-month if the target month is shorter
// (e.g. Jan 31 + 1 month -> Feb 28/29), matching common civil-calendar "final report in one
// month" reporting-clock conventions. Deterministic, no engine Intl/locale dependency.
function addCalendarMonthUtc(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const targetMonthLastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  const clampedDay = Math.min(day, targetMonthLastDay);
  return Date.UTC(y, m + 1, clampedDay, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

function numOrZero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function compute(pp) {
  pp = pp || {};
  const incident_id = typeof pp.incident_id === 'string' ? pp.incident_id : '';
  const classification_at = pp.classification_at;
  const clients_affected_pct = numOrZero(pp.clients_affected_pct);
  const duration_minutes = numOrZero(pp.duration_minutes);
  const geographical_spread_countries_count = numOrZero(pp.geographical_spread_countries_count);
  const data_losses = pp.data_losses === true;
  const economic_impact_amount = numOrZero(pp.economic_impact_amount);
  const critical_services_affected = pp.critical_services_affected === true;
  const reputational_impact = pp.reputational_impact === true;

  const classMs = parseIsoOrNull(classification_at);

  const criteria = [
    {
      criterion_id: 'clients_affected',
      article: 'DORA Art. 18(1)(a); RTS (EU) 2024/1772 clients-affected threshold',
      met: clients_affected_pct >= THRESHOLDS.clients_affected_pct_min,
      value: `${clients_affected_pct}% (threshold >=${THRESHOLDS.clients_affected_pct_min}%)`,
    },
    {
      criterion_id: 'duration',
      article: 'DORA Art. 18(1)(b); RTS (EU) 2024/1772 duration threshold',
      met: duration_minutes >= THRESHOLDS.duration_minutes_min,
      value: `${duration_minutes} min (threshold >=${THRESHOLDS.duration_minutes_min} min)`,
    },
    {
      criterion_id: 'geographical_spread',
      article: 'DORA Art. 18(1)(c); RTS (EU) 2024/1772 geographical-spread threshold',
      met: geographical_spread_countries_count >= THRESHOLDS.geographical_spread_countries_min,
      value: `${geographical_spread_countries_count} member state(s) (threshold >=${THRESHOLDS.geographical_spread_countries_min})`,
    },
    {
      criterion_id: 'data_losses',
      article: 'DORA Art. 18(1)(d); RTS (EU) 2024/1772 data-losses criterion (confidentiality/integrity/availability impact)',
      met: data_losses,
      value: data_losses ? 'Data loss reported' : 'No data loss reported',
    },
    {
      criterion_id: 'economic_impact',
      article: 'DORA Art. 18(1)(e); RTS (EU) 2024/1772 economic-impact threshold',
      met: economic_impact_amount >= THRESHOLDS.economic_impact_eur_min,
      value: `EUR ${economic_impact_amount} (threshold >=EUR ${THRESHOLDS.economic_impact_eur_min})`,
    },
    {
      criterion_id: 'critical_services_affected',
      article: 'DORA Art. 18(1)(f); RTS (EU) 2024/1772 criticality-of-services criterion',
      met: critical_services_affected,
      value: critical_services_affected ? 'Critical/important function affected' : 'No critical/important function affected',
    },
    {
      criterion_id: 'reputational_impact',
      article: 'DORA Art. 18(1)(g); RTS (EU) 2024/1772 reputational-impact criterion',
      met: reputational_impact,
      value: reputational_impact ? 'Reputational impact reported' : 'No reputational impact reported',
    },
  ];

  // Gateway logic (documented approximation, see header): a "gateway" criterion (clients
  // affected OR critical services affected) plus at least one other met criterion triggers
  // MAJOR; data_losses independently triggers MAJOR regardless of the gateway (confidentiality/
  // integrity/availability impact on data is treated in the RTS as capable of standing alone).
  const gatewayMet = criteria.find((c) => c.criterion_id === 'clients_affected').met
    || criteria.find((c) => c.criterion_id === 'critical_services_affected').met;
  const metCount = criteria.filter((c) => c.met).length;
  const otherMetCount = metCount - (gatewayMet ? 1 : 0);
  const dataLossIndependentTrigger = data_losses;
  const major = dataLossIndependentTrigger || (gatewayMet && otherMetCount >= 1) || metCount >= 2;
  const verdict = major ? 'MAJOR' : 'NON_MAJOR';

  const qualifying_criteria = criteria.filter((c) => c.met).map((c) => c.criterion_id);

  let reporting_clock = null;
  if (major && classMs != null) {
    const initialMs = classMs + 4 * HOUR_MS;
    const intermediateMs = classMs + 72 * HOUR_MS;
    const finalMs = addCalendarMonthUtc(classMs);
    reporting_clock = {
      classification_at: isoOrNull(classMs),
      initial_notification_deadline: isoOrNull(initialMs),
      intermediate_report_deadline: isoOrNull(intermediateMs),
      final_report_deadline: isoOrNull(finalMs),
      note: 'Initial notification 4h, intermediate report 72h, final report 1 calendar month -- all clocked from classification_at (see kernel header for citation + confidence caveat).',
    };
  }

  const compliance_flags = [];
  compliance_flags.push(major ? 'DORA_MAJOR_INCIDENT' : 'DORA_NON_MAJOR_INCIDENT');
  if (major) compliance_flags.push('DORA_REPORTING_OBLIGATION_TRIGGERED');
  if (classMs == null && major) compliance_flags.push('CLASSIFICATION_TIMESTAMP_MISSING_OR_UNPARSEABLE');
  if (data_losses) compliance_flags.push('DATA_LOSSES_REPORTED');

  const output_payload = {
    incident_id: String(incident_id || ''),
    verdict,
    major_incident: major,
    qualifying_criteria,
    criteria_detail: criteria,
    reporting_clock,
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    note: 'Deterministic DORA (Art. 18) major-incident classification over caller-declared severity dimensions, plus a DORA Art. 19 reporting-clock (initial/intermediate/final) once classified major. See art-428-cyber-incident-clock.kernel.mjs for the analogous US notification-clock pattern. This kernel classifies and computes deadlines only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice. Criticality of the affected function/provider (critical_services_affected) is a caller-supplied input, not computed or judged here.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
