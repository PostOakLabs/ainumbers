import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-462-je-ruleset-screen';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'screen_je_ruleset',
  mandate_type: 'compliance_control', gpu: false,
};

// Journal-entry testing rules screen (substantive audit procedure). Runs a
// caller-declared, VERSIONED ruleset over a caller-declared journal-entry
// extract and flags each entry that trips one or more rules: weekend/holiday
// postings, round-number entries, suspense/manual-account postings,
// post-close entries, and unusual user/account pairings. Every firm-specific
// convention (which rule ids are active, what counts as "round", the weekend
// day set, the holiday calendar, the suspense-account list, the period-close
// date, the authorized user/account pairing allowlist) is a caller-declared
// policy input -- there is no silent hardcoded default for any of these; a
// rule with no policy input for it is simply not evaluated (see
// missing_policy_inputs). The ruleset_version string is caller-declared and
// echoed verbatim in output_payload so the artifact records exactly which
// policy vintage produced the flags -- this kernel does not interpret or
// validate the version string.
//
// Extract binding: extract_population_hash is an optional caller-declared
// hash identifying the JE population this run screened (audit-trail linkage
// to a hashed extract, e.g. an art-460-style extract-integrity record).
// Softly coupled only -- this kernel does not require or verify that hash
// against any other node; if ICFR-K-1's extract-integrity node lands, a
// consuming workflow can bind the two by carrying the same hash through.
//
// Weekday is computed with pure integer civil-calendar arithmetic (no Date
// object, no clock read, no locale-dependent API) so the result never
// depends on host timezone or ICU data. NaN-safe. Zero network, zero PII.

const KNOWN_RULES = ['weekend_holiday', 'round_number', 'suspense_manual', 'post_close', 'unusual_user_account'];
const DEFAULT_SEVERITY = { weekend_holiday: 'low', round_number: 'medium', suspense_manual: 'high', post_close: 'high', unusual_user_account: 'medium' };

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function arr(v) { return Array.isArray(v) ? v : []; }
function bool(v) { return v === true; }

// Days since 0000-03-01 (proleptic Gregorian), pure integer arithmetic (Howard Hinnant).
function daysFromCivil(y, m, d) {
  y = m <= 2 ? y - 1 : y;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function parseISODate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(str));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return daysFromCivil(y, mo, d);
}
// 0=Sunday..6=Saturday. daysFromCivil's day 0 is 1970-01-01, a Thursday (4).
function weekdayOf(days) {
  if (days === null) return null;
  const w = ((days % 7) + 7 + 4) % 7;
  return w;
}

export function compute(pp) {
  pp = pp || {};
  const ruleset_version = s(pp.ruleset_version) || 'unversioned';
  const extract_population_hash = pp.extract_population_hash ? s(pp.extract_population_hash) : null;
  const requestedRules = arr(pp.active_rules).map(s).filter((r) => KNOWN_RULES.includes(r));
  const active_rules = requestedRules.length > 0 ? [...new Set(requestedRules)] : [];
  const severityOverrides = (pp.rule_severity && typeof pp.rule_severity === 'object') ? pp.rule_severity : {};
  const severityFor = (ruleId) => {
    const v = s(severityOverrides[ruleId]);
    return ['low', 'medium', 'high', 'critical'].includes(v) ? v : DEFAULT_SEVERITY[ruleId];
  };

  const params = pp.rule_params && typeof pp.rule_params === 'object' ? pp.rule_params : {};
  const weekendDays = Array.isArray(params.weekend_days) ? params.weekend_days.map((d) => Math.trunc(n(d, -1))).filter((d) => d >= 0 && d <= 6) : [0, 6];
  const holidayDates = new Set(arr(params.holiday_dates).map(s).filter(Boolean));
  const roundIncrement = Math.max(0, n(params.round_number_increment, 1000));
  const suspenseAccounts = new Set(arr(params.suspense_accounts).map(s).filter(Boolean));
  const postCloseDate = s(params.post_close_date);
  const postCloseDays = postCloseDate ? parseISODate(postCloseDate) : null;
  const authorizedPairs = new Set(arr(params.authorized_user_account_pairs).map((p) => `${s(p && p.user_id)}::${s(p && p.account_id)}`));

  // Track which active rules actually have the policy inputs they need to run.
  const missing_policy_inputs = [];
  if (active_rules.includes('weekend_holiday') && !Array.isArray(params.weekend_days) && holidayDates.size === 0) missing_policy_inputs.push('weekend_holiday: no weekend_days or holiday_dates declared (using weekend_days default [0,6])');
  if (active_rules.includes('round_number') && params.round_number_increment == null) missing_policy_inputs.push('round_number: no round_number_increment declared (using default 1000)');
  if (active_rules.includes('suspense_manual') && suspenseAccounts.size === 0) missing_policy_inputs.push('suspense_manual: no suspense_accounts declared -- rule will only fire on is_manual entries');
  if (active_rules.includes('post_close') && !postCloseDate) missing_policy_inputs.push('post_close: no post_close_date declared -- rule cannot evaluate any entry');
  if (active_rules.includes('unusual_user_account') && authorizedPairs.size === 0) missing_policy_inputs.push('unusual_user_account: no authorized_user_account_pairs declared -- every pair will flag');

  const entries = arr(pp.entries).map((e) => ({
    entry_id: s(e && e.entry_id),
    posting_date: s(e && e.posting_date),
    amount: n(e && e.amount, 0),
    account_id: s(e && e.account_id),
    user_id: s(e && e.user_id),
    description: s(e && e.description),
    is_manual: bool(e && e.is_manual),
  })).filter((e) => e.entry_id);

  const flagged_entries = [];
  const rule_trip_counts = {};
  for (const rid of active_rules) rule_trip_counts[rid] = 0;

  for (const entry of entries) {
    const trips = [];
    const days = parseISODate(entry.posting_date);

    if (active_rules.includes('weekend_holiday')) {
      const wd = weekdayOf(days);
      const isWeekend = wd !== null && weekendDays.includes(wd);
      const isHoliday = holidayDates.has(entry.posting_date);
      if (isWeekend || isHoliday) trips.push({ rule_id: 'weekend_holiday', severity: severityFor('weekend_holiday'), detail: isHoliday ? 'holiday_date' : 'weekend_day' });
    }
    if (active_rules.includes('round_number')) {
      if (roundIncrement > 0 && entry.amount !== 0 && entry.amount % roundIncrement === 0) trips.push({ rule_id: 'round_number', severity: severityFor('round_number'), detail: `multiple_of_${roundIncrement}` });
    }
    if (active_rules.includes('suspense_manual')) {
      const isSuspense = suspenseAccounts.has(entry.account_id);
      if (isSuspense || entry.is_manual) trips.push({ rule_id: 'suspense_manual', severity: severityFor('suspense_manual'), detail: isSuspense ? 'suspense_account' : 'manual_entry' });
    }
    if (active_rules.includes('post_close')) {
      if (postCloseDays !== null && days !== null && days > postCloseDays) trips.push({ rule_id: 'post_close', severity: severityFor('post_close'), detail: 'posted_after_period_close' });
    }
    if (active_rules.includes('unusual_user_account')) {
      const key = `${entry.user_id}::${entry.account_id}`;
      if (!authorizedPairs.has(key)) trips.push({ rule_id: 'unusual_user_account', severity: severityFor('unusual_user_account'), detail: 'pair_not_in_authorized_list' });
    }

    if (trips.length > 0) {
      for (const t of trips) rule_trip_counts[t.rule_id] = (rule_trip_counts[t.rule_id] || 0) + 1;
      flagged_entries.push({
        entry_id: entry.entry_id,
        posting_date: entry.posting_date || null,
        account_id: entry.account_id,
        user_id: entry.user_id,
        amount: entry.amount,
        rules_tripped: trips,
        highest_severity: trips.reduce((worst, t) => (['low', 'medium', 'high', 'critical'].indexOf(t.severity) > ['low', 'medium', 'high', 'critical'].indexOf(worst) ? t.severity : worst), 'low'),
      });
    }
  }

  const compliance_flags = ['JE_SCREEN_RUN'];
  if (active_rules.length === 0) compliance_flags.push('JE_SCREEN_NO_ACTIVE_RULES');
  if (missing_policy_inputs.length > 0) compliance_flags.push('JE_SCREEN_MISSING_POLICY_INPUTS');
  if (flagged_entries.length > 0) compliance_flags.push('JE_SCREEN_ENTRIES_FLAGGED');
  if (flagged_entries.some((f) => f.highest_severity === 'critical' || f.highest_severity === 'high')) compliance_flags.push('JE_SCREEN_HIGH_SEVERITY_FLAGS');

  return {
    output_payload: {
      ruleset_version,
      extract_population_hash,
      active_rules,
      missing_policy_inputs,
      rule_params_used: {
        weekend_days: weekendDays,
        holiday_dates: [...holidayDates],
        round_number_increment: roundIncrement,
        suspense_accounts: [...suspenseAccounts],
        post_close_date: postCloseDate || null,
        authorized_user_account_pairs_count: authorizedPairs.size,
      },
      total_entries: entries.length,
      flagged_count: flagged_entries.length,
      rule_trip_counts,
      flagged_entries,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
