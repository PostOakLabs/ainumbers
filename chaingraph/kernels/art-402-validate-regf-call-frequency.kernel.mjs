import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-402-validate-regf-call-frequency';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_regf_call_frequency',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Reg F (12 CFR 1006.14(b)) call-frequency presumptions over a declared call log:
// (1) 7-in-7: more than seven telephone calls placed to a person in connection
// with the collection of a single debt within any period of seven consecutive
// days is a rebuttable presumption of harassment (1006.14(b)(2)(i)).
// (2) Quiet period: placing a telephone call to a person in connection with the
// collection of a debt within seven days after having had a telephone
// conversation with that person in connection with collection of that same
// debt is a rebuttable presumption of harassment (1006.14(b)(2)(ii)).
// Pure interval counting over declared timestamps; calendar-day bucketing under
// a declared timezone offset (no live timezone database, no Date.now()/new
// Date() -- every date comes from a declared input). This is a PRESUMPTION
// check over the declared call log, not a finding that harassment occurred --
// 1006.14(b)(2) presumptions are rebuttable.

const MS_PER_DAY = 86400000;
const WINDOW_DAYS = 7;

function safeInt(v, def) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : def; }

// Parses a declared "YYYY-MM-DDTHH:MM:SS[Z]" timestamp into epoch ms. If the
// string carries no explicit "Z"/offset suffix, the declared
// timezone_offset_minutes shifts it to true UTC (local = UTC + offset).
function parseTimestamp(raw, tzOffsetMinutes) {
  if (typeof raw !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z)?$/.exec(raw.trim());
  if (!m) return NaN;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  if (!Number.isFinite(utcMs)) return NaN;
  if (m[7] === 'Z') return utcMs;
  return utcMs - tzOffsetMinutes * 60000;
}

// Calendar-day index under the declared timezone (floor of local-shifted ms / day).
function dayIndex(epochMs, tzOffsetMinutes) {
  return Math.floor((epochMs + tzOffsetMinutes * 60000) / MS_PER_DAY);
}

export function compute(pp) {
  pp = pp || {};
  const { inputs = {} } = pp;
  const tzOffsetMinutes = safeInt(inputs.timezone_offset_minutes, 0);
  const rawCalls = Array.isArray(inputs.calls) ? inputs.calls : [];

  const calls = rawCalls.map((c, idx) => {
    const epoch_ms = parseTimestamp(c && c.timestamp, tzOffsetMinutes);
    return {
      input_index: idx,
      debt_id: (c && typeof c.debt_id === 'string') ? c.debt_id : 'UNSPECIFIED',
      timestamp: c && c.timestamp,
      connected: !!(c && c.connected),
      epoch_ms,
      day_index: Number.isFinite(epoch_ms) ? dayIndex(epoch_ms, tzOffsetMinutes) : NaN,
      valid: Number.isFinite(epoch_ms),
    };
  });

  const invalid_call_indices = calls.filter((c) => !c.valid).map((c) => c.input_index);
  const validCalls = calls.filter((c) => c.valid);

  const byDebt = new Map();
  for (const c of validCalls) {
    if (!byDebt.has(c.debt_id)) byDebt.set(c.debt_id, []);
    byDebt.get(c.debt_id).push(c);
  }

  const debts = [];
  const compliance_flags = [];

  for (const [debt_id, list] of byDebt) {
    const sorted = list.slice().sort((a, b) => a.epoch_ms - b.epoch_ms || a.input_index - b.input_index);

    // 7-in-7: at each call, count calls whose day falls in [day-6, day] (a
    // rolling 7-calendar-day window, inclusive both ends). The 8th call
    // landing in that same window trips the presumption at that call.
    const seven_in_seven_trips = [];
    for (let i = 0; i < sorted.length; i++) {
      const day = sorted[i].day_index;
      const windowStart = day - (WINDOW_DAYS - 1);
      let count = 0;
      for (let j = 0; j <= i; j++) {
        if (sorted[j].day_index >= windowStart && sorted[j].day_index <= day) count++;
      }
      if (count > WINDOW_DAYS) {
        seven_in_seven_trips.push({
          input_index: sorted[i].input_index,
          timestamp: sorted[i].timestamp,
          calls_in_window: count,
          window_start_day_offset: windowStart,
        });
      }
    }

    // Quiet period: for each call, look back for the most recent PRIOR
    // connected call on the same debt strictly before it; if the gap in
    // calendar days is 1..7 (inclusive), the call is presumptively prohibited.
    const quiet_period_violations = [];
    for (let i = 0; i < sorted.length; i++) {
      let priorConnectedDay = null;
      let priorConnectedIndex = null;
      for (let j = i - 1; j >= 0; j--) {
        if (sorted[j].connected) { priorConnectedDay = sorted[j].day_index; priorConnectedIndex = sorted[j].input_index; break; }
      }
      if (priorConnectedDay === null) continue;
      const daysSince = sorted[i].day_index - priorConnectedDay;
      if (daysSince >= 1 && daysSince <= WINDOW_DAYS) {
        quiet_period_violations.push({
          input_index: sorted[i].input_index,
          timestamp: sorted[i].timestamp,
          prior_connected_input_index: priorConnectedIndex,
          days_since_conversation: daysSince,
        });
      }
    }

    const has_7in7 = seven_in_seven_trips.length > 0;
    const has_quiet_period = quiet_period_violations.length > 0;
    if (has_7in7) compliance_flags.push(`REGF_7IN7_PRESUMPTION_DEBT_${debt_id}`);
    if (has_quiet_period) compliance_flags.push(`REGF_QUIET_PERIOD_PRESUMPTION_DEBT_${debt_id}`);

    debts.push({
      debt_id,
      calls_checked: sorted.length,
      seven_in_seven_presumption: has_7in7,
      seven_in_seven_trips,
      quiet_period_presumption: has_quiet_period,
      quiet_period_violations,
    });
  }

  debts.sort((a, b) => a.debt_id < b.debt_id ? -1 : a.debt_id > b.debt_id ? 1 : 0);

  if (invalid_call_indices.length > 0) compliance_flags.push('REGF_UNPARSEABLE_TIMESTAMPS');

  const output_payload = {
    debts_checked: debts.length,
    debts_with_seven_in_seven_presumption: debts.filter((d) => d.seven_in_seven_presumption).length,
    debts_with_quiet_period_presumption: debts.filter((d) => d.quiet_period_presumption).length,
    debts,
    invalid_call_indices,
    timezone_offset_minutes_applied: tzOffsetMinutes,
    window_days: WINDOW_DAYS,
    disambiguation: 'validate_regf_call_frequency checks the declared call log against the 12 CFR 1006.14(b)(2) 7-in-7 and post-conversation quiet-period REBUTTABLE PRESUMPTIONS -- it does not determine that harassment occurred, and a debt collector may rebut either presumption with evidence under 1006.14(b)(3).',
    regulatory_basis: '12 CFR 1006.14(b)(2)(i) (more than seven calls within seven consecutive days per debt) and 1006.14(b)(2)(ii) (a call within seven days after a telephone conversation on that debt); presumptions are rebuttable per 1006.14(b)(3).',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
