import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-566-iolta-three-way-reconciliation';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_iolta_three_way_reconciliation',
  mandate_type: 'compliance_control', gpu: false,
};

// IOLTA three-way trust account reconciliation (art-566).
//
// WHAT IT ENFORCES. Every small law firm reconciles its client trust account monthly: the bank
// statement, the firm's trust ledger (the single book-of-record balance for the whole account),
// and the sum of every client's individual ledger must all agree at the same as-of moment.
// Trust-accounting failures -- an account that does not three-way reconcile, or a client ledger
// that goes negative because another client's funds covered a shortfall -- are the leading source
// of attorney discipline referrals. This kernel performs the arithmetic a firm already does by
// hand in a spreadsheet and turns it into a receipted, re-derivable result.
//
// THREE CHECKS, NOT ONE DISPLAY. (a) three-way equality: the bank balance, adjusted for deposits
// in transit and uncleared checks, must equal the trust ledger total, which must equal the sum of
// every per-client ledger balance. (b) no client ledger may go negative at any point during the
// period -- a negative per-client balance while the trust account as a whole is positive is the
// single most common commingling fact pattern (one client's funds paying for another's
// disbursement). (c) every outstanding item (deposit in transit or uncleared check) is aged from
// the statement period end, so an item outstanding for months -- itself a red flag -- is visible
// rather than buried inside a balancing adjustment. (d) every input balance must be stated as of
// the SAME period-end date; a reconciliation across mismatched as-of dates is not a reconciliation.
//
// SCOPE. This kernel performs arithmetic only, over caller-declared balances and caller-declared
// per-client ledger activity. It does not source, derive, or independently verify any balance, and
// it does not determine which bank lines are outstanding -- the caller declares outstanding items
// directly, the same way a firm already lists them on its reconciliation worksheet.
//
// CLAUSE. ABA Model Rule 1.15 (Safekeeping Property) requires complete records of client trust
// funds and reconciliation of those records. State record-keeping rules govern the specifics and
// vary by jurisdiction; this kernel cites Model Rule 1.15 plus a small set of dated state examples
// as illustrations, never a 50-state table -- the arithmetic is state-invariant, the applicable
// rule text is the user's jurisdiction to confirm.
//
// TOLERANCE IS A DECLARED INPUT, NEVER A DEFAULT. An unstated tolerance would turn every rounding
// difference into a break, so absence emits the did-not-run outcome with a reason rather than a
// silent zero. A negative per-client balance is NEVER tolerance-gated -- Model Rule 1.15 draws a
// bright line at zero, not "materially close to zero."
//
// MINOR UNITS. Every balance, ledger entry, and outstanding item is an integer minor unit (cents),
// so every operation here is exact integer arithmetic -- no floating-point residue. Non-integer
// input is REJECTED rather than coerced.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_CLIENTS = 60;
const MAX_OUTSTANDING = 200;
const MAX_ENTRIES_PER_CLIENT = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function s(v) { return String(v == null ? '' : v).trim(); }

function minorInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function abs(n) { return n < 0 ? -n : n; }

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

// Whole-day difference between two YYYY-MM-DD dates, treated as UTC midnights so no timezone or
// DST offset can move the count. Positive when `to` is later than `from`.
function dayDiff(fromDate, toDate) {
  const a = Date.parse(fromDate + 'T00:00:00Z');
  const b = Date.parse(toDate + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function ageBucket(days) {
  if (days < 0) return 'future_dated';
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

const SCOPE_NOTE = 'Performs arithmetic only over caller-declared bank, trust-ledger, and per-client-ledger balances plus caller-declared outstanding items. Does not source, derive, or independently verify any balance and does not determine which bank lines are outstanding.';
const CLAUSE_NOTE = 'ABA Model Rule 1.15 (Safekeeping Property) requires complete trust-fund records and reconciliation of those records. State record-keeping requirements govern the specifics and are not restated here (e.g. California Rule of Professional Conduct 1.15 / trust accounting rules effective 2018-11-01; New York Rule 1.15, 22 NYCRR Part 1200, as amended; Texas Disciplinary Rule 1.14) -- confirm the current rule text for the applicable jurisdiction.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      verdict: 'INCOMPLETE',
      statement_period: (extra && extra.statement_period) || null,
      reconciliation_tolerance_minor: (extra && typeof extra.reconciliation_tolerance_minor === 'number') ? extra.reconciliation_tolerance_minor : null,
      three_way: null,
      client_count: (extra && typeof extra.client_count === 'number') ? extra.client_count : 0,
      negative_balance_findings: [],
      outstanding_items: [],
      outstanding_summary: null,
      period_boundary_consistent: null,
      period_boundary_mismatches: [],
      findings: [],
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  // -- Tolerance: declared or nothing.
  const toleranceDeclared = pp.reconciliation_tolerance_minor !== undefined && pp.reconciliation_tolerance_minor !== null && pp.reconciliation_tolerance_minor !== '';
  const reconciliation_tolerance_minor = toleranceDeclared ? minorInt(pp.reconciliation_tolerance_minor) : null;
  if (!toleranceDeclared) {
    rejected_inputs.push({ where: 'reconciliation_tolerance_minor', reason: 'absent -- a tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('reconciliation_tolerance_not_declared', { rejected_inputs }, ['IOLTA_TOLERANCE_NOT_DECLARED']);
  }
  if (reconciliation_tolerance_minor === null || reconciliation_tolerance_minor < 0) {
    rejected_inputs.push({ where: 'reconciliation_tolerance_minor', reason: 'not a non-negative safe integer number of minor units', supplied: typeof pp.reconciliation_tolerance_minor === 'number' ? pp.reconciliation_tolerance_minor : s(pp.reconciliation_tolerance_minor) });
    return emptyResult('reconciliation_tolerance_not_declared', { rejected_inputs }, ['IOLTA_TOLERANCE_NOT_DECLARED']);
  }

  // -- Statement period.
  const periodIn = (pp.statement_period && typeof pp.statement_period === 'object') ? pp.statement_period : {};
  const start_date = isDate(periodIn.start_date) ? periodIn.start_date : null;
  const end_date = isDate(periodIn.end_date) ? periodIn.end_date : null;
  if (!start_date) rejected_inputs.push({ where: 'statement_period.start_date', reason: 'absent or not YYYY-MM-DD', supplied: periodIn.start_date === undefined ? null : s(periodIn.start_date) });
  if (!end_date) rejected_inputs.push({ where: 'statement_period.end_date', reason: 'absent or not YYYY-MM-DD', supplied: periodIn.end_date === undefined ? null : s(periodIn.end_date) });
  if (start_date && end_date && start_date > end_date) rejected_inputs.push({ where: 'statement_period', reason: 'start_date is after end_date', supplied: start_date + '..' + end_date });
  const periodValid = !!(start_date && end_date && start_date <= end_date);
  const statement_period = periodValid ? { start_date, end_date } : null;

  // -- Bank leg.
  const bankIn = (pp.bank && typeof pp.bank === 'object') ? pp.bank : {};
  const bank_ending_balance_minor = minorInt(bankIn.ending_balance_minor);
  const bank_statement_date = isDate(bankIn.statement_date) ? bankIn.statement_date : null;
  if (bank_ending_balance_minor === null) rejected_inputs.push({ where: 'bank.ending_balance_minor', reason: 'absent or not an integer number of minor units', supplied: null });
  if (!bank_statement_date) rejected_inputs.push({ where: 'bank.statement_date', reason: 'absent or not YYYY-MM-DD', supplied: bankIn.statement_date === undefined ? null : s(bankIn.statement_date) });

  // -- Trust ledger leg.
  const trustIn = (pp.trust_ledger && typeof pp.trust_ledger === 'object') ? pp.trust_ledger : {};
  const trust_ending_balance_minor = minorInt(trustIn.ending_balance_minor);
  const trust_as_of = isDate(trustIn.as_of) ? trustIn.as_of : null;
  if (trust_ending_balance_minor === null) rejected_inputs.push({ where: 'trust_ledger.ending_balance_minor', reason: 'absent or not an integer number of minor units', supplied: null });
  if (!trust_as_of) rejected_inputs.push({ where: 'trust_ledger.as_of', reason: 'absent or not YYYY-MM-DD', supplied: trustIn.as_of === undefined ? null : s(trustIn.as_of) });

  // -- Per-client ledgers.
  const clientsIn = Array.isArray(pp.client_ledgers) ? pp.client_ledgers : [];
  const client_ledgers = [];
  const seenClients = new Map();
  let clientTotal = 0;
  const negative_balance_findings = [];

  for (let i = 0; i < clientsIn.length && client_ledgers.length < MAX_CLIENTS; i++) {
    const row = clientsIn[i] || {};
    const client_id = s(row.client_id);
    const ending_balance_minor = minorInt(row.ending_balance_minor);
    const as_of = isDate(row.as_of) ? row.as_of : null;
    if (!client_id) { rejected_inputs.push({ where: 'client_ledgers[' + i + '].client_id', reason: 'absent', supplied: null }); continue; }
    if (seenClients.has(client_id)) { rejected_inputs.push({ where: 'client_ledgers[' + i + '].client_id', reason: 'duplicate client_id', supplied: client_id }); continue; }
    if (ending_balance_minor === null) { rejected_inputs.push({ where: 'client_ledgers[' + i + '].ending_balance_minor', reason: 'absent or not an integer number of minor units', supplied: client_id }); continue; }
    if (!as_of) { rejected_inputs.push({ where: 'client_ledgers[' + i + '].as_of', reason: 'absent or not YYYY-MM-DD', supplied: client_id }); continue; }

    const entriesIn = Array.isArray(row.entries) ? row.entries.slice(0, MAX_ENTRIES_PER_CLIENT) : [];
    const entries = [];
    for (let j = 0; j < entriesIn.length; j++) {
      const e = entriesIn[j] || {};
      const date = isDate(e.date) ? e.date : null;
      const amount_minor = minorInt(e.amount_minor);
      if (!date || amount_minor === null) {
        rejected_inputs.push({ where: 'client_ledgers[' + i + '].entries[' + j + ']', reason: 'date must be YYYY-MM-DD and amount_minor an integer number of minor units', supplied: client_id });
        continue;
      }
      entries.push({ date, amount_minor, description: s(e.description) });
    }
    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Opening balance is derived: the entries are declared as the period's own activity, so
    // ending minus the sum of activity is the balance the client carried into the period.
    const activitySum = entries.reduce((acc, e) => acc + e.amount_minor, 0);
    const opening_balance_minor = ending_balance_minor - activitySum;
    let running = opening_balance_minor;
    let min_running = running;
    let min_running_date = start_date;
    for (const e of entries) {
      running += e.amount_minor;
      if (running < min_running) { min_running = running; min_running_date = e.date; }
    }
    if (min_running < 0) {
      negative_balance_findings.push({ client_id, low_point_minor: min_running, low_point_date: min_running_date });
    }

    seenClients.set(client_id, true);
    clientTotal += ending_balance_minor;
    client_ledgers.push({ client_id, ending_balance_minor, as_of, opening_balance_minor, low_point_minor: min_running, low_point_date: min_running_date, entry_count: entries.length });
  }
  if (clientsIn.length > MAX_CLIENTS) rejected_inputs.push({ where: 'client_ledgers', reason: 'more than ' + MAX_CLIENTS + ' client ledgers supplied', supplied: clientsIn.length });
  if (client_ledgers.length === 0) rejected_inputs.push({ where: 'client_ledgers', reason: 'absent or empty -- at least one per-client ledger is required for the three-way check', supplied: null });

  // -- Outstanding items (declared, not derived -- the caller lists them the way a firm already
  // does on its reconciliation worksheet).
  const outIn = Array.isArray(pp.outstanding_items) ? pp.outstanding_items.slice(0, MAX_OUTSTANDING) : [];
  const outstanding_items = [];
  let depositsInTransitTotal = 0;
  let unclearedChecksTotal = 0;
  for (let i = 0; i < outIn.length; i++) {
    const row = outIn[i] || {};
    const type = row.type === 'deposit_in_transit' || row.type === 'uncleared_check' ? row.type : null;
    const date = isDate(row.date) ? row.date : null;
    const amount_minor = minorInt(row.amount_minor);
    if (!type || !date || amount_minor === null || amount_minor <= 0) {
      rejected_inputs.push({ where: 'outstanding_items[' + i + ']', reason: 'type must be deposit_in_transit/uncleared_check, date YYYY-MM-DD, amount_minor a positive integer', supplied: row.type === undefined ? null : s(row.type) });
      continue;
    }
    const age_days = periodValid ? dayDiff(date, end_date) : null;
    const age_bucket = age_days === null ? null : ageBucket(age_days);
    if (type === 'deposit_in_transit') depositsInTransitTotal += amount_minor; else unclearedChecksTotal += amount_minor;
    outstanding_items.push({ type, date, amount_minor, description: s(row.description), age_days, age_bucket });
  }
  if (outIn.length > MAX_OUTSTANDING) rejected_inputs.push({ where: 'outstanding_items', reason: 'more than ' + MAX_OUTSTANDING + ' outstanding items supplied', supplied: outIn.length });

  const requiredMissing = bank_ending_balance_minor === null || !bank_statement_date
    || trust_ending_balance_minor === null || !trust_as_of || !periodValid || client_ledgers.length === 0;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', { statement_period, reconciliation_tolerance_minor, client_count: client_ledgers.length, rejected_inputs }, ['IOLTA_REQUIRED_INPUTS_INCOMPLETE']);
  }

  // -- (a) three-way equality.
  const adjusted_bank_balance_minor = bank_ending_balance_minor + depositsInTransitTotal - unclearedChecksTotal;
  const bank_vs_trust_minor = adjusted_bank_balance_minor - trust_ending_balance_minor;
  const trust_vs_clients_minor = trust_ending_balance_minor - clientTotal;
  const bank_vs_clients_minor = adjusted_bank_balance_minor - clientTotal;
  const three_way_equality_holds = abs(bank_vs_trust_minor) <= reconciliation_tolerance_minor
    && abs(trust_vs_clients_minor) <= reconciliation_tolerance_minor
    && abs(bank_vs_clients_minor) <= reconciliation_tolerance_minor;

  const three_way = {
    bank_ending_balance_minor,
    deposits_in_transit_total_minor: depositsInTransitTotal,
    uncleared_checks_total_minor: unclearedChecksTotal,
    adjusted_bank_balance_minor,
    trust_ledger_ending_balance_minor: trust_ending_balance_minor,
    client_ledger_total_minor: clientTotal,
    bank_vs_trust_minor,
    trust_vs_clients_minor,
    bank_vs_clients_minor,
    equality_holds: three_way_equality_holds,
  };

  // -- (d) period-boundary consistency.
  const period_boundary_mismatches = [];
  if (bank_statement_date !== end_date) period_boundary_mismatches.push({ where: 'bank.statement_date', expected: end_date, supplied: bank_statement_date });
  if (trust_as_of !== end_date) period_boundary_mismatches.push({ where: 'trust_ledger.as_of', expected: end_date, supplied: trust_as_of });
  for (const c of client_ledgers) {
    if (c.as_of !== end_date) period_boundary_mismatches.push({ where: 'client_ledgers[' + c.client_id + '].as_of', expected: end_date, supplied: c.as_of });
  }
  const period_boundary_consistent = period_boundary_mismatches.length === 0;

  const outstanding_summary = {
    deposits_in_transit_total_minor: depositsInTransitTotal,
    uncleared_checks_total_minor: unclearedChecksTotal,
    item_count: outstanding_items.length,
    aged_over_90_count: outstanding_items.filter((it) => it.age_bucket === '90+').length,
    aged_61_to_90_count: outstanding_items.filter((it) => it.age_bucket === '61-90').length,
  };

  // -- Findings.
  const findings = [];
  if (!three_way_equality_holds) {
    findings.push({ code: 'THREE_WAY_EQUALITY_BREAK', severity: 'high', message: 'Adjusted bank balance, trust ledger total, and sum of client ledgers do not agree within tolerance.' });
  }
  for (const nb of negative_balance_findings) {
    findings.push({ code: 'CLIENT_LEDGER_WENT_NEGATIVE', severity: 'high', message: 'Client ' + nb.client_id + ' ledger reached ' + nb.low_point_minor + ' minor units on ' + nb.low_point_date + '.', client_id: nb.client_id });
  }
  if (!period_boundary_consistent) {
    findings.push({ code: 'PERIOD_BOUNDARY_INCONSISTENT', severity: 'high', message: 'One or more balances are stated as of a date other than the statement period end.' });
  }
  if (outstanding_summary.aged_over_90_count > 0) {
    findings.push({ code: 'OUTSTANDING_ITEM_AGED_OVER_90_DAYS', severity: 'high', message: outstanding_summary.aged_over_90_count + ' outstanding item(s) are more than 90 days old as of period end.' });
  }
  if (outstanding_summary.aged_61_to_90_count > 0) {
    findings.push({ code: 'OUTSTANDING_ITEM_AGED_61_TO_90_DAYS', severity: 'warning', message: outstanding_summary.aged_61_to_90_count + ' outstanding item(s) are 61-90 days old as of period end.' });
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const verdict = hasHigh ? 'DISCREPANT' : 'RECONCILED';
  const gate_policy = hasHigh ? 'review_required' : 'auto_pass';

  const compliance_flags = ['IOLTA_THREE_WAY_RECONCILIATION_EVALUATED'];
  if (!three_way_equality_holds) compliance_flags.push('IOLTA_THREE_WAY_EQUALITY_BREAK');
  if (negative_balance_findings.length > 0) compliance_flags.push('IOLTA_CLIENT_LEDGER_NEGATIVE');
  if (!period_boundary_consistent) compliance_flags.push('IOLTA_PERIOD_BOUNDARY_INCONSISTENT');
  if (outstanding_summary.aged_over_90_count > 0) compliance_flags.push('IOLTA_OUTSTANDING_ITEM_STALE');
  if (rejected_inputs.length > 0) compliance_flags.push('IOLTA_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      verdict,
      statement_period,
      reconciliation_tolerance_minor,
      three_way,
      client_count: client_ledgers.length,
      client_ledgers,
      negative_balance_findings,
      outstanding_items,
      outstanding_summary,
      period_boundary_consistent,
      period_boundary_mismatches,
      findings,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
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
