import { executionHash } from './_hash.mjs';

const TOOL_ID = '796-payment-system-mi-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_payment_system_mi_pack',
  mandate_type: 'compliance_control', gpu: false,
};

// Payment system management-information pack -- compute a fixed KPI set (speed,
// availability, failure, fraud, complaints, adoption, cost, transparency) from
// DECLARED AGGREGATE COUNTS ONLY, against fixed definitions carried in the node
// metadata's definition_ref values (no citation lives in this file).
//
// METHOD:
//   1. Validate the declared shape. The profile must be one of the closed
//      four-value set. Every declared numeric field must be numeric; declared
//      count fields must be non-negative integers.
//   2. Compute each KPI from the aggregates in basis-point arithmetic. ONE
//      rounding rule everywhere: round half-up at the final step only, to
//      integer basis points; percent values are basis points divided by 100
//      (2 decimal places).
//   3. A KPI whose inputs are missing is null with a reason code
//      (NOT_DECLARED / ZERO_DENOMINATOR / NEGATIVE_INPUT / MISSING_DENOMINATOR)
//      -- never zero.
//   4. Data-quality flags: channel totals that do not sum to the declared
//      total; a credited-within-one-hour (or one-business-day) count above the
//      transaction total; negative declared values.
//   5. Where prior_period is declared, emit absolute and percentage deltas for
//      every KPI that is non-null on both sides.
//
// REFUSALS (closed, each with a reachable path + fixture):
//   - profile outside the closed four-value set: refused (the target set and
//     notes are profile-keyed; an unknown profile has no defined targets).
//   - transactions.count missing or not a non-negative integer: refused (every
//     rate denominates on it).
//   - a string value in a declared numeric field: refused (identifier-like or
//     free text by construction; never echoed).
//
// Domain exclusions (declared, not computed): aggregate counts only -- no
// transaction-level records, no personal data, no interpolation or
// annualisation of partially declared periods. This node produces KPIs, not
// verdicts: it does not reconcile individual records and does not audit
// statements (the reconciliation and audit nodes art-516 and art-517 do that).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date/new Date(), no
// Math.random, no TextEncoder/atob/btoa/URL.

const PROFILES = ['generic', 'g20_retail', 'fast_payment_scheme', 'gov_payments'];
const SPEED_TARGET_PCT = 75;          // applies on g20_retail / fast_payment_scheme
const AVAILABILITY_TARGET_PCT = 99.9; // applies on fast_payment_scheme / gov_payments (reference)

function isCount(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
function isNeg(v) { return typeof v === 'number' && Number.isFinite(v) && v < 0; }
// half-up at the final step only; ratios are non-negative here
function bps(ratio) { return Math.round(ratio * 10000); }       // integer basis points
function pct(ratio) { return Math.round(ratio * 10000) / 100; } // percent, 2 dp

// Scan a flat declared shape for the first string member (refusal guard).
function firstStringField(obj, fields) {
  if (!obj || typeof obj !== 'object') return null;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (typeof obj[f] === 'string') return f;
  }
  return null;
}

function failureCount(failures) {
  if (!Array.isArray(failures)) return null;
  let sum = 0;
  for (let i = 0; i < failures.length; i++) {
    const e = failures[i];
    if (!e || !isCount(e.count)) return null;
    sum += e.count;
  }
  return sum;
}

function refused(verdict_because, extra, compliance_flags, refusedField) {
  const payload = {
    verdict: 'refused',
    refused_because: verdict_because,
  };
  payload[verdict_because] = true; // reachable-path marker: the refusal reason is also a truthy member
  payload.kpis = []; payload.data_quality = []; payload.deltas = []; payload.profile_notes = [];
  payload.evidence = {
    record_type: 'payment_system_mi_pack', tool_id: TOOL_ID, tool_version: TOOL_VERSION,
    computed_from: 'declared_aggregate_counts_only', pii_carried: false, refused: true,
  };
  payload.manual_review_required = true;
  if (refusedField !== undefined && refusedField !== null) payload.refused_field = refusedField;
  if (extra) { for (const k in extra) payload[k] = extra[k]; }
  return { output_payload: payload, compliance_flags };
}

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];
  const profile = pp.profile;

  // -- Refusal 1: profile outside the closed four-value set.
  if (PROFILES.indexOf(profile) === -1) {
    compliance_flags.push('PROFILE_NOT_IN_CLOSED_SET_REFUSED');
    return refused('profile_not_in_closed_set', { allowed_profiles: PROFILES }, compliance_flags);
  }

  const tx = (pp.transactions && typeof pp.transactions === 'object') ? pp.transactions : {};

  // -- Refusal 2: a string in a declared numeric field (checked before coercion).
  const refusalField =
    firstStringField(tx, ['count', 'value', 'credited_within_1h_count', 'credited_within_1bd_count']) ||
    firstStringField(pp.availability, ['scheduled_minutes', 'unplanned_downtime_minutes', 'incidents']) ||
    firstStringField(pp.fraud, ['count', 'value']) ||
    firstStringField(pp.complaints, ['received', 'resolved_within_sla']) ||
    firstStringField(pp.adoption, ['active_users', 'eligible_population', 'accepting_merchants_or_agencies']) ||
    firstStringField(pp.cost, ['fee_value']) ||
    firstStringField(pp.transparency, ['services_disclosing_cost_and_speed', 'services_total']);
  if (refusalField !== null) {
    compliance_flags.push('IDENTIFIER_LIKE_FIELD_REFUSED');
    return refused('identifier_or_free_text_value_in_declared_field', null, compliance_flags, refusalField);
  }

  // -- Refusal 3: transactions.count must be a non-negative integer.
  if (!isCount(tx.count)) {
    compliance_flags.push('TRANSACTION_TOTAL_MISSING_OR_INVALID_REFUSED');
    return refused('transactions_count_missing_or_not_nonnegative_integer', null, compliance_flags);
  }

  const totalCount = tx.count;
  const totalValue = isNum(tx.value) ? tx.value : (isNeg(tx.value) ? null : null);
  const dq = [];
  const negatives = [];
  function negTrack(section, field, v) { if (isNeg(v)) negatives.push(section + '.' + field); }
  negTrack('transactions', 'value', tx.value);
  negTrack('transactions', 'credited_within_1h_count', tx.credited_within_1h_count);
  negTrack('transactions', 'credited_within_1bd_count', tx.credited_within_1bd_count);

  // -- Data quality: channel reconciliation.
  const channels = Array.isArray(tx.by_channel) ? tx.by_channel : [];
  if (channels.length > 0) {
    let cCount = 0, cValue = 0, ok = true;
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (!ch || !isCount(ch.count)) { ok = false; break; }
      negTrack('by_channel[' + i + ']', 'count', ch.count);
      negTrack('by_channel[' + i + ']', 'value', ch.value);
      cCount += ch.count;
      cValue += isNum(ch.value) ? ch.value : 0;
    }
    if (ok) {
      if (cCount !== totalCount) {
        dq.push({ flag: 'CHANNEL_COUNT_TOTALS_MISMATCH', detail: { channel_sum: cCount, declared_total: totalCount } });
        compliance_flags.push('CHANNEL_COUNT_TOTALS_MISMATCH');
      }
      if (isNum(tx.value) && Math.abs(cValue - tx.value) > 1e-9) {
        dq.push({ flag: 'CHANNEL_VALUE_TOTALS_MISMATCH', detail: { channel_sum: cValue, declared_total: tx.value } });
        compliance_flags.push('CHANNEL_VALUE_TOTALS_MISMATCH');
      }
    }
  }

  const credited1h = isCount(tx.credited_within_1h_count) ? tx.credited_within_1h_count : null;
  const credited1bd = isCount(tx.credited_within_1bd_count) ? tx.credited_within_1bd_count : null;
  if (credited1h !== null && credited1h > totalCount) {
    dq.push({ flag: 'CREDITED_WITHIN_1H_ABOVE_TOTAL', detail: { credited_within_1h_count: credited1h, declared_total: totalCount } });
    compliance_flags.push('CREDITED_WITHIN_1H_ABOVE_TOTAL');
  }
  if (credited1bd !== null && credited1bd > totalCount) {
    dq.push({ flag: 'CREDITED_WITHIN_1BD_ABOVE_TOTAL', detail: { credited_within_1bd_count: credited1bd, declared_total: totalCount } });
    compliance_flags.push('CREDITED_WITHIN_1BD_ABOVE_TOTAL');
  }

  const avail = (pp.availability && typeof pp.availability === 'object') ? pp.availability : {};
  const fraud = (pp.fraud && typeof pp.fraud === 'object') ? pp.fraud : {};
  const complaints = (pp.complaints && typeof pp.complaints === 'object') ? pp.complaints : {};
  const adoption = (pp.adoption && typeof pp.adoption === 'object') ? pp.adoption : {};
  const cost = (pp.cost && typeof pp.cost === 'object') ? pp.cost : {};
  const transparency = (pp.transparency && typeof pp.transparency === 'object') ? pp.transparency : {};

  negTrack('availability', 'scheduled_minutes', avail.scheduled_minutes);
  negTrack('availability', 'unplanned_downtime_minutes', avail.unplanned_downtime_minutes);
  negTrack('availability', 'incidents', avail.incidents);
  negTrack('fraud', 'count', fraud.count);
  negTrack('fraud', 'value', fraud.value);
  negTrack('complaints', 'received', complaints.received);
  negTrack('complaints', 'resolved_within_sla', complaints.resolved_within_sla);
  negTrack('adoption', 'active_users', adoption.active_users);
  negTrack('adoption', 'eligible_population', adoption.eligible_population);
  negTrack('adoption', 'accepting_merchants_or_agencies', adoption.accepting_merchants_or_agencies);
  negTrack('cost', 'fee_value', cost.fee_value);
  negTrack('transparency', 'services_disclosing_cost_and_speed', transparency.services_disclosing_cost_and_speed);
  negTrack('transparency', 'services_total', transparency.services_total);
  if (negatives.length > 0) {
    dq.push({ flag: 'NEGATIVE_DECLARED_VALUE', detail: { fields: negatives } });
    compliance_flags.push('NEGATIVE_DECLARED_VALUE');
  }
  const neg = {};
  for (let i = 0; i < negatives.length; i++) neg[negatives[i]] = true;

  // -- KPI construction. value:null carries a reason_code, never zero.
  const kpis = [];
  function kpi(id, value, unit, defRef, reasonCode, target) {
    const k = { kpi_id: id, value: value, unit: unit, definition_ref: defRef };
    if (value === null) k.reason_code = reasonCode || 'NOT_DECLARED';
    if (target !== undefined && target !== null) {
      k.target = target;
      k.meets_target = value === null ? null : value >= target;
    }
    kpis.push(k);
  }

  // speed
  const speedTarget = (profile === 'g20_retail' || profile === 'fast_payment_scheme') ? SPEED_TARGET_PCT : null;
  if (neg['transactions.credited_within_1h_count']) {
    kpi('speed_pct_within_1h', null, 'percent', 'g20_speed_target+fsb_speed_kpi1', 'NEGATIVE_INPUT', speedTarget);
  } else if (credited1h === null) {
    kpi('speed_pct_within_1h', null, 'percent', 'g20_speed_target+fsb_speed_kpi1', 'NOT_DECLARED', speedTarget);
  } else if (totalCount === 0) {
    kpi('speed_pct_within_1h', null, 'percent', 'g20_speed_target+fsb_speed_kpi1', 'ZERO_DENOMINATOR', speedTarget);
  } else {
    kpi('speed_pct_within_1h', pct(credited1h / totalCount), 'percent', 'g20_speed_target+fsb_speed_kpi1', null, speedTarget);
  }
  if (neg['transactions.credited_within_1bd_count']) {
    kpi('speed_pct_within_1bd', null, 'percent', 'g20_speed_target+fsb_speed_kpi2', 'NEGATIVE_INPUT');
  } else if (credited1bd === null) {
    kpi('speed_pct_within_1bd', null, 'percent', 'g20_speed_target+fsb_speed_kpi2', 'NOT_DECLARED');
  } else if (totalCount === 0) {
    kpi('speed_pct_within_1bd', null, 'percent', 'g20_speed_target+fsb_speed_kpi2', 'ZERO_DENOMINATOR');
  } else {
    kpi('speed_pct_within_1bd', pct(credited1bd / totalCount), 'percent', 'g20_speed_target+fsb_speed_kpi2', null);
  }

  // cost
  if (neg['cost.fee_value']) {
    kpi('cost_avg_fee_bps', null, 'bps_of_transaction_value', 'fsb_cost_kpi_family_adapted', 'NEGATIVE_INPUT');
  } else if (!isNum(cost.fee_value)) {
    kpi('cost_avg_fee_bps', null, 'bps_of_transaction_value', 'fsb_cost_kpi_family_adapted', 'NOT_DECLARED');
  } else if (!isNum(tx.value) && !isNeg(tx.value)) {
    kpi('cost_avg_fee_bps', null, 'bps_of_transaction_value', 'fsb_cost_kpi_family_adapted', 'MISSING_DENOMINATOR');
  } else if (tx.value === 0) {
    kpi('cost_avg_fee_bps', null, 'bps_of_transaction_value', 'fsb_cost_kpi_family_adapted', 'ZERO_DENOMINATOR');
  } else {
    kpi('cost_avg_fee_bps', bps(cost.fee_value / tx.value), 'bps_of_transaction_value', 'fsb_cost_kpi_family_adapted', null);
  }

  // failure
  const fCount = failureCount(pp.failures);
  if (fCount === null) {
    kpi('failure_rate_bps', null, 'bps_of_transactions', 'design_convention', 'NOT_DECLARED');
  } else if (totalCount === 0) {
    kpi('failure_rate_bps', null, 'bps_of_transactions', 'design_convention', 'ZERO_DENOMINATOR');
  } else {
    kpi('failure_rate_bps', bps(fCount / totalCount), 'bps_of_transactions', 'design_convention', null);
  }

  // availability (reference target on operational profiles)
  const availTarget = (profile === 'fast_payment_scheme' || profile === 'gov_payments') ? AVAILABILITY_TARGET_PCT : null;
  const sched = typeof avail.scheduled_minutes === 'number' && Number.isFinite(avail.scheduled_minutes) ? avail.scheduled_minutes : null;
  const down = typeof avail.unplanned_downtime_minutes === 'number' && Number.isFinite(avail.unplanned_downtime_minutes) ? avail.unplanned_downtime_minutes : null;
  if (neg['availability.scheduled_minutes'] || neg['availability.unplanned_downtime_minutes']) {
    kpi('availability_pct', null, 'percent', 'pfmi_p17_anchor_design_convention', 'NEGATIVE_INPUT', availTarget);
  } else if (sched === null || down === null) {
    kpi('availability_pct', null, 'percent', 'pfmi_p17_anchor_design_convention', 'NOT_DECLARED', availTarget);
  } else if (sched === 0) {
    kpi('availability_pct', null, 'percent', 'pfmi_p17_anchor_design_convention', 'ZERO_DENOMINATOR', availTarget);
  } else {
    kpi('availability_pct', pct((sched - down) / sched), 'percent', 'pfmi_p17_anchor_design_convention', null, availTarget);
  }

  // fraud
  if (neg['fraud.value']) {
    kpi('fraud_rate_bps', null, 'bps_of_transaction_value', 'design_convention', 'NEGATIVE_INPUT');
  } else if (!isNum(fraud.value)) {
    kpi('fraud_rate_bps', null, 'bps_of_transaction_value', 'design_convention', 'NOT_DECLARED');
  } else if (!isNum(tx.value) && !isNeg(tx.value)) {
    kpi('fraud_rate_bps', null, 'bps_of_transaction_value', 'design_convention', 'MISSING_DENOMINATOR');
  } else if (tx.value === 0) {
    kpi('fraud_rate_bps', null, 'bps_of_transaction_value', 'design_convention', 'ZERO_DENOMINATOR');
  } else {
    kpi('fraud_rate_bps', bps(fraud.value / tx.value), 'bps_of_transaction_value', 'design_convention', null);
  }
  if (neg['fraud.count']) {
    kpi('fraud_count_share_bps', null, 'bps_of_transactions', 'design_convention', 'NEGATIVE_INPUT');
  } else if (!isCount(fraud.count)) {
    kpi('fraud_count_share_bps', null, 'bps_of_transactions', 'design_convention', 'NOT_DECLARED');
  } else if (totalCount === 0) {
    kpi('fraud_count_share_bps', null, 'bps_of_transactions', 'design_convention', 'ZERO_DENOMINATOR');
  } else {
    kpi('fraud_count_share_bps', bps(fraud.count / totalCount), 'bps_of_transactions', 'design_convention', null);
  }

  // complaints
  if (neg['complaints.received'] || neg['complaints.resolved_within_sla']) {
    kpi('complaints_resolution_pct', null, 'percent', 'design_convention', 'NEGATIVE_INPUT');
  } else if (!isCount(complaints.received) || typeof complaints.resolved_within_sla !== 'number' || !Number.isFinite(complaints.resolved_within_sla)) {
    kpi('complaints_resolution_pct', null, 'percent', 'design_convention', 'NOT_DECLARED');
  } else if (complaints.received === 0) {
    kpi('complaints_resolution_pct', null, 'percent', 'design_convention', 'ZERO_DENOMINATOR');
  } else {
    kpi('complaints_resolution_pct', pct(complaints.resolved_within_sla / complaints.received), 'percent', 'design_convention', null);
  }

  // adoption
  if (neg['adoption.active_users'] || neg['adoption.eligible_population']) {
    kpi('adoption_users_per_1000_eligible', null, 'users_per_1000_eligible', 'fsb_access_kpi_family_adapted', 'NEGATIVE_INPUT');
  } else if (!isCount(adoption.active_users) || !isCount(adoption.eligible_population)) {
    kpi('adoption_users_per_1000_eligible', null, 'users_per_1000_eligible', 'fsb_access_kpi_family_adapted', 'NOT_DECLARED');
  } else if (adoption.eligible_population === 0) {
    kpi('adoption_users_per_1000_eligible', null, 'users_per_1000_eligible', 'fsb_access_kpi_family_adapted', 'ZERO_DENOMINATOR');
  } else {
    kpi('adoption_users_per_1000_eligible', pct(adoption.active_users / adoption.eligible_population * 10), 'users_per_1000_eligible', 'fsb_access_kpi_family_adapted', null);
  }
  if (neg['adoption.accepting_merchants_or_agencies']) {
    kpi('adoption_accepting_locations', null, 'locations', 'design_convention', 'NEGATIVE_INPUT');
  } else if (!isCount(adoption.accepting_merchants_or_agencies)) {
    kpi('adoption_accepting_locations', null, 'locations', 'design_convention', 'NOT_DECLARED');
  } else {
    kpi('adoption_accepting_locations', adoption.accepting_merchants_or_agencies, 'locations', 'design_convention', null);
  }

  // transparency
  if (neg['transparency.services_disclosing_cost_and_speed'] || neg['transparency.services_total']) {
    kpi('transparency_disclosure_pct', null, 'percent', 'fsb_transparency_kpi1_adapted', 'NEGATIVE_INPUT');
  } else if (!isCount(transparency.services_total) || !isCount(transparency.services_disclosing_cost_and_speed)) {
    kpi('transparency_disclosure_pct', null, 'percent', 'fsb_transparency_kpi1_adapted', 'NOT_DECLARED');
  } else if (transparency.services_total === 0) {
    kpi('transparency_disclosure_pct', null, 'percent', 'fsb_transparency_kpi1_adapted', 'ZERO_DENOMINATOR');
  } else {
    kpi('transparency_disclosure_pct', pct(transparency.services_disclosing_cost_and_speed / transparency.services_total), 'percent', 'fsb_transparency_kpi1_adapted', null);
  }

  kpis.sort(function (a, b) { return a.kpi_id < b.kpi_id ? -1 : a.kpi_id > b.kpi_id ? 1 : 0; });

  // -- Deltas vs prior_period (same aggregate shape), KPIs non-null on both sides.
  const deltas = [];
  const prior = (pp.prior_period && typeof pp.prior_period === 'object') ? pp.prior_period : null;
  if (prior) {
    let priorOut = null;
    try {
      priorOut = compute({ profile: profile, transactions: prior.transactions, failures: prior.failures, availability: prior.availability, fraud: prior.fraud, complaints: prior.complaints, adoption: prior.adoption, cost: prior.cost, transparency: prior.transparency });
    } catch (e) { priorOut = null; }
    if (priorOut && priorOut.output_payload && priorOut.output_payload.verdict === 'completed') {
      const priorMap = {};
      const pk = priorOut.output_payload.kpis;
      for (let i = 0; i < pk.length; i++) priorMap[pk[i].kpi_id] = pk[i];
      for (let i = 0; i < kpis.length; i++) {
        const cur = kpis[i];
        const pr = priorMap[cur.kpi_id];
        if (!pr || cur.value === null || pr.value === null) continue;
        const d = {
          kpi_id: cur.kpi_id,
          current: cur.value,
          prior: pr.value,
          abs_delta: Math.round((cur.value - pr.value) * 100) / 100,
        };
        d.pct_delta = pr.value === 0 ? null : pct((cur.value - pr.value) / Math.abs(pr.value));
        deltas.push(d);
      }
      deltas.sort(function (a, b) { return a.kpi_id < b.kpi_id ? -1 : a.kpi_id > b.kpi_id ? 1 : 0; });
    } else {
      dq.push({ flag: 'PRIOR_PERIOD_NOT_COMPUTABLE', detail: {} });
      compliance_flags.push('PRIOR_PERIOD_NOT_COMPUTABLE');
    }
  }

  // -- Profile notes.
  const profile_notes = [];
  if (profile === 'g20_retail' || profile === 'fast_payment_scheme') {
    profile_notes.push('speed_pct_within_1h is compared against the pinned 75-percent-within-one-hour speed target on this profile.');
  }
  if (profile === 'generic') {
    profile_notes.push('No targets apply on the generic profile; the pinned speed target is profile-keyed and is not claimed for an unspecified scheme.');
  }
  if (profile === 'gov_payments') {
    profile_notes.push('Government-payments profile: collections and disbursements channels are carried as declared channels; availability is compared against the 99.9-percent reference level, which is a design convention, not a published standard target.');
  }
  profile_notes.push('All figures are computed from declared aggregate counts only; no transaction-level or personal data is accepted.');
  profile_notes.push('Definition sources for every KPI are carried in each KPI definition_ref and documented on the node page.');

  const nullCount = kpis.filter(function (k) { return k.value === null; }).length;

  const output_payload = {
    verdict: 'completed',
    profile: profile,
    period: (pp.period && typeof pp.period === 'object') ? { start: pp.period.start || null, end: pp.period.end || null } : null,
    kpis: kpis,
    data_quality: dq,
    deltas: deltas,
    profile_notes: profile_notes,
    evidence: {
      record_type: 'payment_system_mi_pack',
      tool_id: TOOL_ID,
      tool_version: TOOL_VERSION,
      computed_from: 'declared_aggregate_counts_only',
      pii_carried: false,
      kpis_emitted: kpis.length,
      kpis_null_with_reason: nullCount,
      data_quality_flags: dq.length,
      deltas_emitted: deltas.length,
    },
    manual_review_required: dq.length > 0,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
