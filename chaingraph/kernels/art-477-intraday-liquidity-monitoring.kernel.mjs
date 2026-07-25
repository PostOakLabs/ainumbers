import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-477-intraday-liquidity-monitoring';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_intraday_liquidity_monitoring',
  mandate_type: 'compliance_mandate', gpu: false,
};

// BCBS 248 "Monitoring tools for intraday liquidity management" (Basel Committee, April 2013).
// Scoped to the caller-driven daily-usage metrics (not the full seven-tool BCBS 248 suite):
//  (1) Daily maximum intraday liquidity usage: the caller supplies a time-stamped list of
//      settlement transactions (inflow/outflow). The kernel sorts them by time and walks a
//      cumulative NET settlement position starting at zero (BCBS 248 tool 1 measures usage from
//      the day's payment activity, independent of the opening balance); the largest negative
//      value that cumulative position reaches during the day is the daily maximum intraday
//      liquidity usage. A day with no negative excursion has zero usage.
//  (2) Available intraday liquidity at start of day: echoed caller input, not derived --
//      BCBS 248 tool 2 is itself a policy/balance-sheet figure, not a computable quantity here.
//  (3) Total payments: gross value of outflow transactions for the day (BCBS 248 tool 3), reported
//      alongside total receipts (inflow transactions) for context.
//  (4) Time-specific obligations: for each caller-supplied obligation (a due time and, if
//      settled, a settlement time), the kernel determines whether it was met by its due time
//      (BCBS 248 tool 4) using lexical HH:MM string comparison -- no Date object, no timezone math.
//  (5) Classification vs available sources: the caller supplies a list of available intraday
//      liquidity sources (e.g. central bank balances, committed lines, collateral); the kernel
//      sums them and compares the total against the computed daily maximum usage to flag adequacy.
//
// Times are caller-supplied "HH:MM" 24-hour strings, compared lexically -- pure string/number
// arithmetic only, no Date.now/new Date(), no Math.random. Dollar figures rounded to 2 decimals
// (r2) only at declared output boundaries. Evidence artifact only -- not a filing, not a
// regulatory submission, not a claim of BCBS 248 supervisory-tool coverage beyond the five metrics
// named above.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v, def) { return (typeof v === 'string' && v) ? v : def; }

function normalizeTime(v) {
  const s = str(v, null);
  return (s && /^\d{2}:\d{2}$/.test(s)) ? s : null;
}

function orderTransactions(rows) {
  return rows
    .map((row, idx) => ({
      tx_id: str(row && row.tx_id, 'tx-' + idx),
      time_hhmm: normalizeTime(row && row.time_hhmm) || '00:00',
      flow_type: (row && row.flow_type === 'outflow') ? 'outflow' : 'inflow',
      amount_musd: Math.max(0, safeNum(row && row.amount_musd, 0)),
      _idx: idx,
    }))
    .sort((a, b) => (a.time_hhmm < b.time_hhmm ? -1 : a.time_hhmm > b.time_hhmm ? 1 : a._idx - b._idx));
}

function walkCumulativePosition(ordered) {
  let running = 0;
  let worst = 0;
  const path = ordered.map((tx) => {
    running += tx.flow_type === 'inflow' ? tx.amount_musd : -tx.amount_musd;
    if (running < worst) worst = running;
    return {
      tx_id: tx.tx_id,
      time_hhmm: tx.time_hhmm,
      flow_type: tx.flow_type,
      amount_musd: r2(tx.amount_musd),
      cumulative_position_musd: r2(running),
    };
  });
  return { path, worst, ending: running };
}

function classifyObligations(rows) {
  return arr(rows).map((row, idx) => {
    const dueTime = normalizeTime(row && row.due_time_hhmm) || '00:00';
    const settledTime = normalizeTime(row && row.settled_time_hhmm);
    const settled = settledTime !== null;
    const metOnTime = settled && settledTime <= dueTime;
    return {
      obligation_id: str(row && row.obligation_id, 'obl-' + idx),
      due_time_hhmm: dueTime,
      settled_time_hhmm: settledTime,
      amount_musd: r2(Math.max(0, safeNum(row && row.amount_musd, 0))),
      settled,
      met_on_time: metOnTime,
    };
  });
}

export function compute(pp) {
  pp = pp || {};

  const startOfDayAvailable = r2(Math.max(0, safeNum(pp.start_of_day_available_musd, 0)));

  const ordered = orderTransactions(arr(pp.transactions));
  const { path, worst } = walkCumulativePosition(ordered);
  const daily_max_usage_musd = r2(worst < 0 ? -worst : 0);

  const total_payments_musd = r2(ordered.filter((t) => t.flow_type === 'outflow').reduce((s, t) => s + t.amount_musd, 0));
  const total_receipts_musd = r2(ordered.filter((t) => t.flow_type === 'inflow').reduce((s, t) => s + t.amount_musd, 0));

  const obligations = classifyObligations(pp.time_specific_obligations);
  const obligations_met = obligations.filter((o) => o.met_on_time).length;
  const obligations_missed = obligations.length - obligations_met;

  const sources = arr(pp.available_intraday_sources).map((s, idx) => ({
    source_id: str(s && s.source_id, 'src-' + idx),
    amount_musd: r2(Math.max(0, safeNum(s && s.amount_musd, 0))),
  }));
  const available_sources_total_musd = r2(sources.reduce((sum, s) => sum + s.amount_musd, 0));
  const usage_covered = available_sources_total_musd >= daily_max_usage_musd;
  const coverage_ratio = daily_max_usage_musd > 0 ? r2(available_sources_total_musd / daily_max_usage_musd) : null;

  const compliance_flags = [];
  compliance_flags.push(usage_covered ? 'INTRADAY_USAGE_WITHIN_AVAILABLE_SOURCES' : 'INTRADAY_USAGE_EXCEEDS_AVAILABLE_SOURCES');
  if (obligations.length > 0) {
    compliance_flags.push(obligations_missed === 0 ? 'ALL_TIME_SPECIFIC_OBLIGATIONS_MET' : 'TIME_SPECIFIC_OBLIGATIONS_MISSED');
  }

  const output_payload = {
    start_of_day_available_musd: startOfDayAvailable,
    daily_max_usage_musd,
    cumulative_position_path: path,
    total_payments_musd,
    total_receipts_musd,
    time_specific_obligations: obligations,
    obligations_summary: {
      total_obligations: obligations.length,
      obligations_met: obligations_met,
      obligations_missed: obligations_missed,
    },
    available_intraday_sources: sources,
    available_sources_total_musd,
    usage_covered,
    coverage_ratio,
    regulatory_basis: 'BCBS 248 "Monitoring tools for intraday liquidity management" (Basel Committee on Banking Supervision, April 2013).',
    note: 'Daily maximum intraday liquidity usage is the largest negative excursion of a cumulative net settlement position built from the caller-supplied time-stamped transaction list, starting at zero -- independent of the opening balance. Start-of-day available liquidity, time-specific-obligation timing, and available intraday sources are caller-supplied inputs, echoed and classified, not derived from external data. Evidence artifact only -- not a filing, not a regulatory submission, and not a claim of full BCBS 248 seven-tool coverage.',
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
