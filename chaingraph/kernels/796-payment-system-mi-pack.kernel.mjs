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
//      count fields must be non-negative integers. by_channel and failures
//      must be arrays of well-typed entries; period and prior_period must be
//      objects whose non-empty members are real YYYY-MM-DD calendar dates.
//   2. Compute each KPI from the aggregates in basis-point arithmetic. ONE
//      rounding rule everywhere: round half-up at the final step only, to
//      integer basis points; percent values are basis points divided by 100
//      (2 decimal places).
//   3. A KPI whose inputs are missing is null with a reason code
//      (NOT_DECLARED / ZERO_DENOMINATOR / NEGATIVE_INPUT / MISSING_DENOMINATOR
//      / IMPOSSIBLE_INPUT) -- never zero, and never an impossible value: a
//      part above its whole (downtime above scheduled minutes, resolved above
//      received, active users above the eligible population, disclosing
//      services above total services) or a fractional declared count field is
//      flagged and the affected KPI is null with IMPOSSIBLE_INPUT.
//   4. Data-quality flags: channel totals that do not sum to the declared
//      total; a credited-within-one-hour (or one-business-day) count above the
//      transaction total; negative declared values; fractional declared count
//      fields; impossible declared relations (a part above its whole).
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
//   - any value the shared canonicalizer would reject (an unsafe integer
//     beyond 2^53, a non-finite number, an unsupported type, a structure past
//     the canonicalizer's own depth bound, or more values than its element
//     bound): refused at entry with one stable code per class, so the
//     artifact path never fails mid-build (the shared _hash.mjs stays
//     untouched; a refused input never claims an execution_hash over input
//     the canonicalizer rejects).
//   - by_channel or failures present but not an array, or an entry that is
//     not an object, whose count is not a non-negative integer, or whose
//     value is not a finite number: refused (never silently skipped or
//     reconciled around).
//   - period or prior_period present but not an object, a non-string
//     non-empty member, or a member that is not a real calendar date
//     (month 1-12, day within the month, leap-year aware): refused (never
//     silently ignored, never echoed).
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

// Strict real-calendar-date check (pure arithmetic, no Date object per the
// ECMA-262-only rule below): exactly YYYY-MM-DD, month 1-12, day within the
// real month length for that year, leap-year aware.
function isRealCalendarDate(s) {
  if (typeof s !== 'string' || s.length !== 10 || s.charAt(4) !== '-' || s.charAt(7) !== '-') return false;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[mo - 1];
}

// D4/D6: a declared period must be an object whose non-empty members are real
// calendar dates; anything else (wrong type, non-string member, impossible
// date) is a named violation, never a silently-ignored or echoed value.
function periodViolation(prefix, pv) {
  if (pv === undefined || pv === null) return null;
  if (typeof pv !== 'object' || Array.isArray(pv)) return { field: prefix, because: prefix + '_wrong_type' };
  const members = ['start', 'end'];
  for (let i = 0; i < members.length; i++) {
    const m = pv[members[i]];
    if (m === undefined || m === null || m === '') continue; // absent or empty echoes as null
    if (typeof m !== 'string') return { field: prefix + '.' + members[i], because: prefix + '_member_wrong_type' };
    if (!isRealCalendarDate(m)) return { field: prefix + '.' + members[i], because: prefix + '_date_not_a_real_calendar_date' };
  }
  return null;
}

// I-JSON refusal scan: anything the shared canonicalizer (_hash.mjs) would
// REJECT -- an unsafe integer beyond 2^53, a non-finite number, a bigint, a
// structure deeper than the canonicalizer's own depth bound, or more values
// than its element bound -- is refused here, at compute() entry, with one
// stable code per class, so buildArtifact() never fails mid-build on declared
// input it cannot hash. Mirrors the canonicalizer's own MAX_DEPTH (512) and
// MAX_ELEMENTS (1000000); the depth bound also terminates cyclic input.
const SCAN_DEPTH_MAX = 512;
const SCAN_ELEMENTS_MAX = 1000000;
function ijsonViolation(v, path, depth, counter) {
  if (depth > SCAN_DEPTH_MAX) return { path: path, because: 'input_structure_too_deep' };
  if (++counter.n > SCAN_ELEMENTS_MAX) return { path: path, because: 'input_too_many_values' };
  const t = typeof v;
  if (t === 'number') {
    if (!Number.isFinite(v)) return { path: path, because: 'non_finite_number_in_declared_field' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { path: path, because: 'unsafe_integer_in_declared_field' };
  } else if (t === 'bigint') {
    return { path: path, because: 'unsupported_value_type_in_declared_field' };
  } else if (v !== null && t === 'object') {
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      const seg = Array.isArray(v) ? '[' + i + ']' : '.' + keys[i];
      const hit = ijsonViolation(v[keys[i]], path + seg, depth + 1, counter);
      if (hit) return hit;
    }
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

  // -- Refusal 3: anything the shared canonicalizer would reject (unsafe
  //    integers, non-finite numbers, unsupported types, runaway depth) is
  //    refused at entry; the artifact path hashes the declared input as-is.
  const ijsonHit = ijsonViolation(pp, 'policy_parameters', 1, { n: 0 });
  if (ijsonHit) {
    compliance_flags.push('IJSON_UNSAFE_INPUT_REFUSED');
    return refused(ijsonHit.because, null, compliance_flags, ijsonHit.path);
  }

  // -- Refusal 4: by_channel present but not an array, or a malformed entry.
  if (tx.by_channel !== undefined && tx.by_channel !== null && !Array.isArray(tx.by_channel)) {
    compliance_flags.push('BY_CHANNEL_MALFORMED_REFUSED');
    return refused('by_channel_not_an_array', null, compliance_flags, 'transactions.by_channel');
  }
  const channelList = Array.isArray(tx.by_channel) ? tx.by_channel : [];
  for (let ci = 0; ci < channelList.length; ci++) {
    const che = channelList[ci];
    let badEntry = null;
    if (!che || typeof che !== 'object' || Array.isArray(che)) badEntry = 'by_channel[' + ci + ']';
    else if (!isCount(che.count)) badEntry = 'by_channel[' + ci + '].count';
    else if (che.value !== undefined && che.value !== null && (typeof che.value !== 'number' || !Number.isFinite(che.value))) badEntry = 'by_channel[' + ci + '].value';
    if (badEntry) {
      compliance_flags.push('BY_CHANNEL_MALFORMED_REFUSED');
      return refused('malformed_channel_entry', null, compliance_flags, badEntry);
    }
  }

  // -- Refusal 5: failures present but not an array, or a malformed entry.
  if (pp.failures !== undefined && pp.failures !== null && !Array.isArray(pp.failures)) {
    compliance_flags.push('FAILURES_MALFORMED_REFUSED');
    return refused('failures_not_an_array', null, compliance_flags, 'failures');
  }
  const failureList = Array.isArray(pp.failures) ? pp.failures : [];
  for (let fi = 0; fi < failureList.length; fi++) {
    const fe = failureList[fi];
    let badEntry = null;
    if (!fe || typeof fe !== 'object' || Array.isArray(fe)) badEntry = 'failures[' + fi + ']';
    else if (!isCount(fe.count)) badEntry = 'failures[' + fi + '].count';
    else if (fe.value !== undefined && fe.value !== null && (typeof fe.value !== 'number' || !Number.isFinite(fe.value))) badEntry = 'failures[' + fi + '].value';
    if (badEntry) {
      compliance_flags.push('FAILURES_MALFORMED_REFUSED');
      return refused('malformed_failure_entry', null, compliance_flags, badEntry);
    }
  }

  // -- Refusal 6: period / prior_period wrong-typed or impossible dates.
  const periodHit = periodViolation('period', pp.period) || periodViolation('prior_period', pp.prior_period);
  if (periodHit) {
    compliance_flags.push(periodHit.field.indexOf('prior_period') === 0 ? 'PRIOR_PERIOD_MALFORMED_REFUSED' : 'PERIOD_MALFORMED_REFUSED');
    return refused(periodHit.because, null, compliance_flags, periodHit.field);
  }

  // -- Refusal 7: transactions.count must be a non-negative integer.
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

  // -- Data quality: fractional declared count fields (METHOD 1: declared
  //    count fields must be non-negative integers) and impossible declared
  //    relations (a part above its whole). Each raises a named flag; the KPIs
  //    they make impossible are null with reason IMPOSSIBLE_INPUT, never an
  //    impossible value.
  const fractional = [];
  function fracBad(v) {
    return typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v);
  }
  function fracTrack(section, field, v) {
    if (fracBad(v)) fractional.push(section + '.' + field);
  }
  fracTrack('availability', 'scheduled_minutes', avail.scheduled_minutes);
  fracTrack('availability', 'unplanned_downtime_minutes', avail.unplanned_downtime_minutes);
  fracTrack('availability', 'incidents', avail.incidents);
  if (fractional.length > 0) {
    dq.push({ flag: 'FRACTIONAL_DECLARED_COUNT', detail: { fields: fractional } });
    compliance_flags.push('FRACTIONAL_DECLARED_COUNT');
  }
  const fracAvail = fracBad(avail.scheduled_minutes) || fracBad(avail.unplanned_downtime_minutes);

  let downtimeAboveScheduled = false;
  if (isCount(avail.scheduled_minutes) && avail.scheduled_minutes > 0 && isCount(avail.unplanned_downtime_minutes) && avail.unplanned_downtime_minutes > avail.scheduled_minutes) {
    downtimeAboveScheduled = true;
    dq.push({ flag: 'DOWNTIME_ABOVE_SCHEDULED_MINUTES', detail: { unplanned_downtime_minutes: avail.unplanned_downtime_minutes, scheduled_minutes: avail.scheduled_minutes } });
    compliance_flags.push('DOWNTIME_ABOVE_SCHEDULED_MINUTES');
  }
  let resolvedAboveReceived = false;
  if (isCount(complaints.received) && complaints.received > 0 && typeof complaints.resolved_within_sla === 'number' && Number.isFinite(complaints.resolved_within_sla) && complaints.resolved_within_sla > complaints.received) {
    resolvedAboveReceived = true;
    dq.push({ flag: 'COMPLAINTS_RESOLVED_ABOVE_RECEIVED', detail: { resolved_within_sla: complaints.resolved_within_sla, received: complaints.received } });
    compliance_flags.push('COMPLAINTS_RESOLVED_ABOVE_RECEIVED');
  }
  let activeAboveEligible = false;
  if (isCount(adoption.active_users) && isCount(adoption.eligible_population) && adoption.eligible_population > 0 && adoption.active_users > adoption.eligible_population) {
    activeAboveEligible = true;
    dq.push({ flag: 'ADOPTION_ACTIVE_USERS_ABOVE_ELIGIBLE', detail: { active_users: adoption.active_users, eligible_population: adoption.eligible_population } });
    compliance_flags.push('ADOPTION_ACTIVE_USERS_ABOVE_ELIGIBLE');
  }
  let disclosingAboveTotal = false;
  if (isCount(transparency.services_disclosing_cost_and_speed) && isCount(transparency.services_total) && transparency.services_total > 0 && transparency.services_disclosing_cost_and_speed > transparency.services_total) {
    disclosingAboveTotal = true;
    dq.push({ flag: 'TRANSPARENCY_DISCLOSING_ABOVE_TOTAL', detail: { services_disclosing_cost_and_speed: transparency.services_disclosing_cost_and_speed, services_total: transparency.services_total } });
    compliance_flags.push('TRANSPARENCY_DISCLOSING_ABOVE_TOTAL');
  }

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
  } else if (fracAvail || downtimeAboveScheduled) {
    kpi('availability_pct', null, 'percent', 'pfmi_p17_anchor_design_convention', 'IMPOSSIBLE_INPUT', availTarget);
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
  } else if (resolvedAboveReceived) {
    kpi('complaints_resolution_pct', null, 'percent', 'design_convention', 'IMPOSSIBLE_INPUT');
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
  } else if (activeAboveEligible) {
    kpi('adoption_users_per_1000_eligible', null, 'users_per_1000_eligible', 'fsb_access_kpi_family_adapted', 'IMPOSSIBLE_INPUT');
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
  } else if (disclosingAboveTotal) {
    kpi('transparency_disclosure_pct', null, 'percent', 'fsb_transparency_kpi1_adapted', 'IMPOSSIBLE_INPUT');
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
  let hash;
  try {
    hash = await executionHash(pp, output_payload);
  } catch (e) {
    // compute() already refused every input class the shared canonicalizer
    // rejects (Refusal 3), so this arm is reachable only for the refusal
    // paths themselves: a refused run never claims an execution_hash over
    // declared input the canonicalizer cannot canonicalize. The shared
    // _hash.mjs stays untouched.
    hash = null;
  }
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
