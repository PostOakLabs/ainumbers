// art-09 — DORA Major-Incident Classification Kernel: pure decision kernel.
// DORA-CLOCK-REPAIR-1 (REVERSED D split, ruling 2026-10-01) — art-09 CLASSIFIES per the
// final acts and CONSUMES the 2025/301 clock result from art-467 through the declared
// edge (art-467 declares `feeds` -> art-09; art-09 declares `consumes` <- art-467).
// It stays usable standalone: the clock result may equally be caller-declared in the
// same shape, and a mismatch between this kernel's declared timestamps and the
// consumed clock's origins yields `not_evaluable` stages — never silent precedence.
//
// Pure: no DOM, no window, no network, no wall clock (all timestamps caller-declared).
//
// AUTHORITY (pinned at clause level, chaingraph/standard/clause-snapshot-registry.json,
// retrieved 2026-10-01 from Publications Office CELLAR):
//   - DORA (EU) 2022/2554 (the framework regulation, criteria article) fixes the classification criteria in statutory
//     order (a) clients/counterparties/transactions, (b) duration, (c) geographical
//     spread, (d) data losses, (e) criticality of services affected, (f) economic
//     impact; the two reporting-obligations articles of the same regulation carry the reporting duties the verdict serves.
//   - Commission Delegated Regulation (EU) 2024/1772 (the classification RTS), its classification-gateway
//     paragraph: an incident is MAJOR where it has affected critical services AND either
//     (a) the successful-malicious-access threshold is met, or (b) two or
//     more of the OTHER materiality thresholds (points (1) to (6)) are met. Data loss as
//     an adverse impact sits in the two-other branch, never standalone.
//   - Materiality-threshold limbs (verbatim thresholds): point (1) clients — >10% of all clients using the
//     affected service, or >100,000 affected clients, or >30% of financial
//     counterparts, or >10% of the daily average number of transactions, or >10% of the
//     daily average transaction value, or identification-relevant clients affected (the relevance pinpoint in point (1)(f));
//     point (2) reputational impact per the definition-article conditions; point (3) duration — longer than 24h, or
//     service downtime longer than 2h for ICT services supporting critical/important
//     functions; 9(4) geographical spread — impact in two or more Member States;
//     9(5)(a) data losses — adverse impact on business objectives or regulatory
//     compliance; 9(6) economic impact — costs/losses exceeding EUR 100,000.
//   - Recurring incidents (the aggregation paragraph): individually non-major incidents occurring at
//     least twice within 6 months with the same apparent root cause are ONE major
//     incident where they collectively fulfil the gateway paragraph; assessed monthly; does not
//     apply to microenterprises or the exempt-entity list of the framework regulation.
//
// The former art-09 model (citing the wrong framework article and the draft ESA Joint RTS EBA/RTS/2023/11, any
// single criterion -> MAJOR, intermediate clocked from the initial deadline, final =
// estimated resolution + 30 days) is superseded and fully removed; the clock result is
// no longer computed here at all — it is consumed from art-467 (the time-limits regulation schedule).
//
// States: `determination_code` = not_major | major | not_evaluable | malformed
// (DORA-CLOCK-REPAIR-1 step 2 vocabulary). Per-criterion `not_assessed` flags remain in
// criteria_detail; an unassessed critical-services gateway yields not_evaluable, never a verdict.
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-09-dora-incident-classifier';
const TOOL_VERSION = '2.0.0';

// Stable, caller-visible constants (cited roles — never re-derived in prose strings).
const TABLE_VERSION = 'DORA-2024-1772-ART8-GATEWAY+ART9-LIMBS-2026-10';
const TABLE_SOURCE = 'DORA (EU) 2022/2554 Art. 18(1) (criteria, statutory order (a)-(f)) + Arts. 19-20 (reporting obligations); Commission Delegated Regulation (EU) 2024/1772 Art. 8(1) (critical-services gateway AND (9(5)(b) malicious access OR two or more other Art. 9 thresholds)) + Art. 9(1)-(6) (materiality thresholds with their absolute and relative limbs) + Art. 8(2) (recurring-incident aggregation); clock result consumed from art-467 (2025/301 Art. 5).';

// ISO-8601 datetime with a MANDATORY explicit offset (Z or +/-hh:mm(/hhmm)).
const ISO_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/;

function parseDeclared(s, key, out) {
  if (s == null || s === '') return null;
  if (typeof s !== 'string' || !ISO_OFFSET_RE.test(s)) { out.push(key); return null; }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) { out.push(key); return null; }
  return t;
}
function isoOrNull(ms) { return ms == null ? null : new Date(ms).toISOString(); }
function numOrNull(v, key, out) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) { out.push(key); return null; }
  return n;
}
function boolOrNull(v, key, out) {
  if (typeof v === 'boolean') return v;
  if (v == null) return null;
  out.push(key);
  return null;
}

/**
 * compute(pp) — pure DORA 2024/1772 Art. 8(1) major-incident classifier.
 * pp: {
 *   critical_services_affected?:      boolean, // Art. 6 / Art. 8(1) gateway — THE mandatory gate
 *   // Art. 9(1) clients/counterparties/transactions — any limb met fires the criterion:
 *   clients_affected_pct?:                     number, // > 10% of all clients using the affected service
 *   clients_affected_count?:                   number, // > 100,000 affected clients
 *   financial_counterparts_affected_pct?:      number, // > 30% of financial counterparts on the service
 *   transactions_affected_number_pct?:         number, // > 10% of daily average transaction count
 *   transactions_affected_value_pct?:          number, // > 10% of daily average transaction value
 *   art_1_3_relevant_parties_affected?:        boolean, // Art. 1(3)-relevant clients/counterparts affected
 *   // Art. 9(2) reputational impact (caller assesses the Art. 2(a)-(d) conditions):
 *   reputational_impact?:                      boolean,
 *   // Art. 9(3) duration/downtime:
 *   duration_hours?:                           number, // longer than 24h
 *   critical_function_downtime_minutes?:       number, // downtime longer than 2h on critical/important functions
 *   // Art. 9(4) geographical spread:
 *   member_states_affected_count?:             number, // two or more Member States
 *   // Art. 9(5) data losses:
 *   data_loss_adverse_impact?:                 boolean, // 9(5)(a) adverse impact on objectives/compliance
 *   malicious_access_successful?:              boolean, // 9(5)(b) THE single-condition branch
 *   // Art. 9(6) economic impact:
 *   economic_impact_eur?:                      number, // exceeding EUR 100,000
 *   // Art. 8(2) recurring-incident aggregation (caller submits the COLLECTIVE assessment
 *   // across the group when a group ref is declared):
 *   recurring_incident_group_ref?:             string,
 *   recurring_occurrences_within_6_months?:    number, // at least twice within 6 months
 *   recurring_same_root_cause?:                boolean, // Art. 20 first subpara (b) root cause
 *   recurring_exemption_applies?:              boolean, // microenterprise / Art. 16(1) entity
 *   // Timestamps declared for the consumed-clock consistency check (optional; explicit offset):
 *   awareness_at?:                             string,
 *   classification_at?:                        string,
 *   // The consumed (or caller-declared, same shape) art-467 2025/301 clock result:
 *   reporting_clock?:                          object,
 * }
 */
export function compute(pp) {
  pp = pp || {};

  const malformed = [];
  const gatewayRaw = boolOrNull(pp.critical_services_affected, 'critical_services_affected', malformed);

  const clientsPct = numOrNull(pp.clients_affected_pct, 'clients_affected_pct', malformed);
  const clientsCount = numOrNull(pp.clients_affected_count, 'clients_affected_count', malformed);
  const counterpartsPct = numOrNull(pp.financial_counterparts_affected_pct, 'financial_counterparts_affected_pct', malformed);
  const txNumberPct = numOrNull(pp.transactions_affected_number_pct, 'transactions_affected_number_pct', malformed);
  const txValuePct = numOrNull(pp.transactions_affected_value_pct, 'transactions_affected_value_pct', malformed);
  const relevantParties = boolOrNull(pp.art_1_3_relevant_parties_affected, 'art_1_3_relevant_parties_affected', malformed);
  const reputational = boolOrNull(pp.reputational_impact, 'reputational_impact', malformed);
  const durationHours = numOrNull(pp.duration_hours, 'duration_hours', malformed);
  const downtimeMinutes = numOrNull(pp.critical_function_downtime_minutes, 'critical_function_downtime_minutes', malformed);
  const memberStates = numOrNull(pp.member_states_affected_count, 'member_states_affected_count', malformed);
  const dataLossAdverse = boolOrNull(pp.data_loss_adverse_impact, 'data_loss_adverse_impact', malformed);
  const maliciousAccess = boolOrNull(pp.malicious_access_successful, 'malicious_access_successful', malformed);
  const economicEur = numOrNull(pp.economic_impact_eur, 'economic_impact_eur', malformed);

  const groupRef = typeof pp.recurring_incident_group_ref === 'string' && pp.recurring_incident_group_ref !== '' ? pp.recurring_incident_group_ref : null;
  const groupCount = numOrNull(pp.recurring_occurrences_within_6_months, 'recurring_occurrences_within_6_months', malformed);
  const groupRootCause = boolOrNull(pp.recurring_same_root_cause, 'recurring_same_root_cause', malformed);
  const groupExempt = boolOrNull(pp.recurring_exemption_applies, 'recurring_exemption_applies', malformed);

  const awarenessMs = parseDeclared(pp.awareness_at, 'awareness_at', malformed);
  const classMs = parseDeclared(pp.classification_at, 'classification_at', malformed);

  // --- Per-criterion threshold limbs, in the framework-regulation statutory order ---
  const clientsLimb = (clientsPct != null && clientsPct > 10)
    || (clientsCount != null && clientsCount > 100000)
    || (counterpartsPct != null && counterpartsPct > 30)
    || (txNumberPct != null && txNumberPct > 10)
    || (txValuePct != null && txValuePct > 10)
    || relevantParties === true;
  const durationLimb = (durationHours != null && durationHours > 24)
    || (downtimeMinutes != null && downtimeMinutes > 120);
  const geographicLimb = memberStates != null && memberStates >= 2;
  const dataLossLimb = dataLossAdverse === true; // 9(5)(a) — two-other branch ONLY, never standalone
  const economicLimb = economicEur != null && economicEur > 100000;
  const reputationalLimb = reputational === true; // 9(2)

  const otherThresholdsMetCount = [clientsLimb, reputationalLimb, durationLimb, geographicLimb, dataLossLimb, economicLimb]
    .filter(Boolean).length;

  const criteria = [
    {
      id: 'clients_counterparties_transactions',
      dora_label: 'DORA Art. 18(1)(a) — clients, financial counterparts and transactions affected',
      authority: '2024/1772 Art. 9(1)',
      met: clientsLimb,
      not_assessed: clientsPct == null && clientsCount == null && counterpartsPct == null && txNumberPct == null && txValuePct == null && relevantParties == null,
      limbs: {
        clients_over_10pct: clientsPct != null && clientsPct > 10,
        clients_over_100000: clientsCount != null && clientsCount > 100000,
        counterparts_over_30pct: counterpartsPct != null && counterpartsPct > 30,
        transactions_number_over_10pct: txNumberPct != null && txNumberPct > 10,
        transactions_value_over_10pct: txValuePct != null && txValuePct > 10,
        art_1_3_relevant_parties: relevantParties === true,
      },
    },
    {
      id: 'duration',
      dora_label: 'DORA Art. 18(1)(b) — duration of the incident and service downtime',
      authority: '2024/1772 Art. 9(3)',
      met: durationLimb,
      not_assessed: durationHours == null && downtimeMinutes == null,
      limbs: {
        duration_over_24h: durationHours != null && durationHours > 24,
        downtime_over_2h_critical_important_fn: downtimeMinutes != null && downtimeMinutes > 120,
      },
    },
    {
      id: 'geographical_spread',
      dora_label: 'DORA Art. 18(1)(c) — geographical spread',
      authority: '2024/1772 Art. 9(4)',
      met: geographicLimb,
      not_assessed: memberStates == null,
      limbs: { member_states_two_or_more: geographicLimb },
    },
    {
      id: 'data_losses',
      dora_label: 'DORA Art. 18(1)(d) — data losses',
      authority: '2024/1772 Art. 9(5)(a)',
      met: dataLossLimb,
      not_assessed: dataLossAdverse == null,
      limbs: { adverse_impact_9_5_a: dataLossLimb },
    },
    {
      id: 'criticality_of_services',
      dora_label: 'DORA Art. 18(1)(e) — criticality of services affected (Art. 8(1) GATEWAY)',
      authority: '2024/1772 Art. 6 + Art. 8(1)',
      met: gatewayRaw === true,
      not_assessed: gatewayRaw == null,
      limbs: { critical_services_affected: gatewayRaw === true },
    },
    {
      id: 'economic_impact',
      dora_label: 'DORA Art. 18(1)(f) — economic impact',
      authority: '2024/1772 Art. 9(6)',
      met: economicLimb,
      not_assessed: economicEur == null,
      limbs: { costs_over_eur_100000: economicLimb },
    },
    {
      id: 'reputational_impact',
      dora_label: 'Reputational impact (materiality threshold; counted in the two-other branch)',
      authority: '2024/1772 Art. 9(2)',
      met: reputationalLimb,
      not_assessed: reputational == null,
      limbs: { art_2_conditions_declared: reputationalLimb },
    },
  ];

  // --- Classification gateway: critical services AND (single condition OR two-or-more other thresholds) ---
  const gatewayAssessed = gatewayRaw != null;
  const gatewayMet = gatewayRaw === true;
  const singleConditionMet = maliciousAccess === true; // 9(5)(b)
  const twoOtherMet = otherThresholdsMetCount >= 2;

  // --- Recurring-incident aggregation (the classification RTS aggregation paragraph) ---
  const groupPartiallyDeclared = groupRef != null && (groupCount == null || groupRootCause == null);
  const gatewayBranchMet = gatewayAssessed && gatewayMet && (singleConditionMet || twoOtherMet);
  const groupComplete = groupRef != null && groupCount != null && groupCount >= 2 && groupRootCause === true;
  const aggregationApplied = !gatewayBranchMet ? false : (groupRef != null && groupExempt !== true && groupComplete && groupCount >= 2 && groupRootCause === true);
  let major = gatewayBranchMet || aggregationApplied;

  // --- Determination state (not_major | major | not_evaluable | malformed) ---
  let determination_code;
  if (malformed.length) determination_code = 'malformed';
  else if (!gatewayAssessed || groupPartiallyDeclared) determination_code = 'not_evaluable';
  else determination_code = major ? 'major' : 'not_major';

  const reason_codes = [];
  if (determination_code === 'not_evaluable') {
    if (!gatewayAssessed) reason_codes.push('GATEWAY_NOT_ASSESSED');
    if (groupPartiallyDeclared) reason_codes.push('RECURRING_GROUP_PARTIALLY_DECLARED');
  }
  if (determination_code === 'major') {
    reason_codes.push(aggregationApplied ? 'MAJOR_RECURRING_AGGREGATION_ART_8_2'
      : singleConditionMet ? 'MAJOR_GATEWAY_PLUS_9_5_B_MALICIOUS_ACCESS' : 'MAJOR_GATEWAY_PLUS_TWO_OTHER_THRESHOLDS');
  }
  if (determination_code === 'malformed') reason_codes.push('MALFORMED_INPUTS');

  const qualifying_criteria = criteria.filter((c) => c.met && c.id !== 'criticality_of_services').map((c) => c.id);

  // --- Consumed clock result (REVERSED D): validate origins, never silent precedence ---
  const clockInput = pp.reporting_clock != null && typeof pp.reporting_clock === 'object' && !Array.isArray(pp.reporting_clock) ? pp.reporting_clock : null;
  let reporting_clock = null;
  const clockNotes = [];
  let originMismatch = false;
  if (clockInput) {
    const declaredClassMs = classMs;
    const clockOrigin = typeof clockInput.classification_at === 'string' ? Date.parse(clockInput.classification_at) : null;
    if (declaredClassMs != null && clockOrigin != null && Number.isFinite(clockOrigin) && clockOrigin !== declaredClassMs) {
      originMismatch = true;
    }
    const declaredAwareMs = awarenessMs;
    const clockAwareOrigin = typeof clockInput.awareness_at === 'string' ? Date.parse(clockInput.awareness_at) : null;
    if (declaredAwareMs != null && clockAwareOrigin != null && Number.isFinite(clockAwareOrigin) && clockAwareOrigin !== declaredAwareMs) {
      originMismatch = true;
    }
    const stagesIn = clockInput.stages && typeof clockInput.stages === 'object' ? clockInput.stages : {};
    const mergeStage = (name) => {
      const s = stagesIn[name] != null && typeof stagesIn[name] === 'object' ? stagesIn[name] : {};
      if (originMismatch) {
        return { ...s, state: 'not_evaluable', reason_code: 'CONSUMED_CLOCK_ORIGIN_MISMATCH' };
      }
      return s;
    };
    reporting_clock = {
      ...clockInput,
      consumed_from: 'art-467-dora-incident-classifier',
      binding: major === true && !originMismatch,
      stages: {
        initial_notification: mergeStage('initial_notification'),
        intermediate_report: mergeStage('intermediate_report'),
        final_report: mergeStage('final_report'),
      },
    };
    if (originMismatch) {
      clockNotes.push('Declared timestamps disagree with the consumed clock result origins — stages marked not_evaluable; never silent precedence (DORA-CLOCK-REPAIR-1 step 4, REVERSED).');
    } else if (!major) {
      clockNotes.push('Incident not major under 2024/1772 Art. 8(1): the 2025/301 stage clocks are informational only, not binding.');
    }
  }

  const compliance_flags = [];
    if (determination_code === 'major') {
    compliance_flags.push('DORA_MAJOR_INCIDENT', 'DORA_REPORTING_OBLIGATION_TRIGGERED');
    if (aggregationApplied) compliance_flags.push('DORA_RECURRING_AGGREGATION_APPLIED');
  } else if (determination_code === 'not_major') {
    compliance_flags.push('DORA_NON_MAJOR_INCIDENT');
  } else if (determination_code === 'not_evaluable') {
    compliance_flags.push('DORA_NOT_EVALUABLE');
  } else {
    compliance_flags.push('DORA_MALFORMED_INPUT');
  }
  if (singleConditionMet) compliance_flags.push('DORA_MALICIOUS_ACCESS_SINGLE_CONDITION');
  if (maliciousAccess === false && gatewayMet && twoOtherMet) compliance_flags.push('DORA_TWO_OTHER_THRESHOLDS_BRANCH');
  if (originMismatch) compliance_flags.push('DORA_CONSUMED_CLOCK_ORIGIN_MISMATCH');

  // Flag-mirror doctrine (the authoring standard): the conditional compliance_flags mirror into
  // the payload so gates can route on the caveat without reading compliance_flags.
  const warnings = determination_code === 'major' ? ['REPORTING_OBLIGATION_TRIGGERED'] : [];

  const output_payload = {
    determination_code,
    major_incident: determination_code === 'major',
    determination_reason_codes: reason_codes,
    warnings,
    gateway: {
      critical_services_affected: gatewayRaw === true,
      assessed: gatewayAssessed,
      authority: '2024/1772 Art. 6 + Art. 8(1)',
    },
    malicious_access_single_condition: {
      met: singleConditionMet,
      authority: '2024/1772 Art. 9(5)(b)',
    },
    other_thresholds_met_count: otherThresholdsMetCount,
    two_other_thresholds_branch_met: twoOtherMet,
    qualifying_criteria,
    criteria_detail: criteria,
    recurring_incident_aggregation: {
      group_ref: groupRef,
      occurrences_within_6_months: groupCount == null ? null : groupCount,
      same_root_cause: groupRootCause,
      exemption_applies: groupExempt === true,
      applied: aggregationApplied,
      authority: '2024/1772 Art. 8(2)',
    },
    reporting_clock,
    reporting_clock_notes: clockNotes,
    malformed_inputs: malformed,
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    note: 'DORA 2024/1772 Art. 8(1) classification over caller-declared threshold limbs. The 2025/301 reporting clock is NOT computed here: under the REVERSED D split this kernel consumes the art-467 clock result through the declared edge (art-467 feeds -> art-09) and marks it binding only on a major determination; a mismatch between declared timestamps and consumed origins yields not_evaluable stages, never silent precedence. A caller-declared clock result of the same shape keeps this kernel usable standalone. This kernel classifies only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: 'infrastructure_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_dora_incident', gpu: false, mandate_type: 'infrastructure_mandate' };
