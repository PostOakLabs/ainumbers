import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-579-stock-loan-rebate-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_stock_loan_rebate_fee',
  mandate_type: 'compliance_control', gpu: false,
};

// Stock-loan rebate/fee recompute (art-579).
//
// WHAT IT ENFORCES. A borrower (or the beneficial owner on the lending side) receives a periodic
// statement from an agent lender or prime broker billing the rebate or fee owed on an open
// securities loan. This kernel recomputes that bill from the caller's own declared daily
// collateral and rate data using the standard MSLA/SIFMA daily-accrual convention, then diffs the
// recomputed total against the statement's claimed amount. The money side complementing the
// shipped SLATE reporting tools (which check regulatory transparency reporting, not the bill
// itself).
//
// TWO LOAN BASES, ONE ACCRUAL CONVENTION. A cash-collateralized loan is usually "rebate basis": the
// borrower posts cash collateral, the lender invests it, and the lender pays the borrower a rebate
// equal to a benchmark rate minus a spread the lender keeps as compensation. When the spread
// exceeds the benchmark -- routine for a hard-to-borrow security -- the "rebate" goes negative and
// the borrower instead pays the lender. A loan collateralized by non-cash (or where cash rebate
// isn't used) is "fee basis": the borrower simply pays a flat fee rate on the loaned security's
// market value, always non-negative. Both bases accrue daily on Actual/360 -- the SIFMA/MSLA
// day-count convention for USD cash-collateral rebate calculations -- over the caller's declared
// daily marks, never over a single period-average value.
//
// COLLATERAL-MARK CHECK, SEPARATE FROM THE MONEY DIFF. SIFMA best-practice collateral maintenance
// runs 102% of loaned market value for same-currency collateral, 105% for cross-currency -- the
// caller declares which applies to a given loan and every day's collateral value is checked against
// it. An undercollateralized day is a finding independent of whether the period's rebate/fee total
// happens to match the statement.
//
// SCOPE. Arithmetic only, over caller-declared daily collateral values, loaned-security market
// values, and rate/spread inputs. Does not source or independently verify any value against a DTC
// feed, an agent lender's books, or a Reg SHO threshold-security list, and does not determine
// which collateral maintenance percentage a given master agreement requires -- that is a declared
// input, confirmed against the applicable MSLA.
//
// CLAUSE. SIFMA Master Securities Loan Agreement (MSLA, 2017 version in common use) conventions:
// Actual/360 day-count for USD cash-collateral rebate accrual; 102%/105% collateral maintenance
// thresholds per SIFMA securities lending best practices. FINRA's Securities Lending and
// Transparency Engine (SLATE, Rule 6500 Series, implementing Exchange Act Rule 10c-1a) governs
// regulatory transparency REPORTING of loan terms, a distinct duty from the rebate/fee bill this
// kernel recomputes -- see the shipped SLATE tools for the reporting side.
//
// TOLERANCE AND MARGIN PERCENTAGE ARE DECLARED INPUTS, NEVER DEFAULTS. An unstated tolerance would
// turn every rounding difference into a divergence; an unstated collateral-maintenance percentage
// would silently assume one master agreement's terms over another's.
//
// MINOR UNITS. Every value is an integer minor unit (cents); all arithmetic below is exact integer
// arithmetic with explicit round-half-up (money) or round-up (collateral requirement) rules, never
// floating-point residue. Non-integer input is REJECTED rather than coerced.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_LOANS = 40;
const MAX_DAYS_PER_LOAN = 120;
const MAX_RATE_BPS = 20000; // 200%, generous headroom over any realistic rebate/fee/benchmark rate
const MAX_VALUE_MINOR = 10_000_000_000; // $100,000,000.00 in cents -- bounds every multiply below to a safe integer
const ALLOWED_MARGIN_PCT = [102, 105];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACCRUAL_DENOM = 10000 * 360; // bps -> fraction, then Actual/360

function s(v) { return String(v == null ? '' : v).trim(); }

function boundedInt(v, max) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return (v >= 0 && v <= max) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n) && n >= 0 && n <= max) return n;
  }
  return null;
}

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

// Round-half-up on a signed integer numerator over a positive integer denominator, exact integer
// arithmetic throughout (no floating-point division).
function roundDiv(num, den) {
  const sign = num < 0 ? -1 : 1;
  const n = Math.abs(num);
  return sign * Math.floor((n + Math.floor(den / 2)) / den);
}

// Round-up (ceiling): the required-collateral floor is never understated by a rounding residue.
function ceilDiv(num, den) { return Math.floor((num + den - 1) / den); }

const SCOPE_NOTE = 'Performs arithmetic only over caller-declared daily collateral values, loaned-security market values, and rate/spread inputs. Does not source or independently verify any value against a DTC feed, an agent lender\'s books, or a Reg SHO threshold-security list, and does not determine which collateral maintenance percentage a given master agreement requires.';
const CLAUSE_NOTE = 'SIFMA Master Securities Loan Agreement (MSLA, 2017 version in common use) conventions: Actual/360 day-count for USD cash-collateral rebate accrual; 102% (same-currency) / 105% (cross-currency) collateral maintenance thresholds per SIFMA securities lending best practices. FINRA\'s Securities Lending and Transparency Engine (SLATE, Rule 6500 Series, implementing Exchange Act Rule 10c-1a) governs regulatory transparency reporting of loan terms -- a distinct duty from the rebate/fee bill recomputed here.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      verdict: 'INDETERMINATE',
      statement_period: (extra && extra.statement_period) || null,
      diff_tolerance_minor: (extra && typeof extra.diff_tolerance_minor === 'number') ? extra.diff_tolerance_minor : null,
      required_margin_pct: (extra && typeof extra.required_margin_pct === 'number') ? extra.required_margin_pct : null,
      loan_count: (extra && typeof extra.loan_count === 'number') ? extra.loan_count : 0,
      loans: [],
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

  // -- Diff tolerance: declared or nothing.
  const tolDeclared = pp.diff_tolerance_minor !== undefined && pp.diff_tolerance_minor !== null && pp.diff_tolerance_minor !== '';
  const diff_tolerance_minor = tolDeclared ? boundedInt(pp.diff_tolerance_minor, MAX_VALUE_MINOR) : null;
  if (!tolDeclared) {
    rejected_inputs.push({ where: 'diff_tolerance_minor', reason: 'absent -- a tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('diff_tolerance_not_declared', { rejected_inputs }, ['SECLEND_TOLERANCE_NOT_DECLARED']);
  }
  if (diff_tolerance_minor === null) {
    rejected_inputs.push({ where: 'diff_tolerance_minor', reason: 'not a non-negative safe integer number of minor units within range', supplied: typeof pp.diff_tolerance_minor === 'number' ? pp.diff_tolerance_minor : s(pp.diff_tolerance_minor) });
    return emptyResult('diff_tolerance_not_declared', { rejected_inputs }, ['SECLEND_TOLERANCE_NOT_DECLARED']);
  }

  // -- Required collateral-maintenance percentage: declared, and must be one of the two SIFMA
  // thresholds this kernel supports.
  const marginDeclared = pp.required_margin_pct !== undefined && pp.required_margin_pct !== null && pp.required_margin_pct !== '';
  const required_margin_pct = marginDeclared ? Number(pp.required_margin_pct) : null;
  if (!marginDeclared || !ALLOWED_MARGIN_PCT.includes(required_margin_pct)) {
    rejected_inputs.push({ where: 'required_margin_pct', reason: 'must be declared as 102 (same-currency) or 105 (cross-currency)', supplied: marginDeclared ? pp.required_margin_pct : null });
    return emptyResult('required_margin_pct_not_declared', { diff_tolerance_minor, rejected_inputs }, ['SECLEND_MARGIN_PCT_NOT_DECLARED']);
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

  // -- Loans.
  const loansIn = Array.isArray(pp.loans) ? pp.loans : [];
  const loans = [];
  const seenLoans = new Map();

  for (let i = 0; i < loansIn.length && loans.length < MAX_LOANS; i++) {
    const row = loansIn[i] || {};
    const loan_id = s(row.loan_id);
    const basis = row.basis === 'rebate_basis' || row.basis === 'fee_basis' ? row.basis : null;
    const statement_amount_minor = (typeof row.statement_amount_minor === 'number' && Number.isSafeInteger(row.statement_amount_minor)
      && Math.abs(row.statement_amount_minor) <= MAX_VALUE_MINOR) ? row.statement_amount_minor : null;

    if (!loan_id) { rejected_inputs.push({ where: 'loans[' + i + '].loan_id', reason: 'absent', supplied: null }); continue; }
    if (seenLoans.has(loan_id)) { rejected_inputs.push({ where: 'loans[' + i + '].loan_id', reason: 'duplicate loan_id', supplied: loan_id }); continue; }
    if (!basis) { rejected_inputs.push({ where: 'loans[' + i + '].basis', reason: 'must be rebate_basis or fee_basis', supplied: loan_id }); continue; }
    if (statement_amount_minor === null) { rejected_inputs.push({ where: 'loans[' + i + '].statement_amount_minor', reason: 'absent or not an integer number of minor units within range', supplied: loan_id }); continue; }

    const marksIn = Array.isArray(row.daily_marks) ? row.daily_marks.slice(0, MAX_DAYS_PER_LOAN) : [];
    const daily_marks = [];
    let computed_total_minor = 0;
    const breach_days = [];

    for (let j = 0; j < marksIn.length; j++) {
      const m = marksIn[j] || {};
      const date = isDate(m.date) ? m.date : null;
      const loaned_market_value_minor = boundedInt(m.loaned_market_value_minor, MAX_VALUE_MINOR);
      const collateral_value_minor = boundedInt(m.collateral_value_minor, MAX_VALUE_MINOR);
      if (!date || loaned_market_value_minor === null || collateral_value_minor === null) {
        rejected_inputs.push({ where: 'loans[' + i + '].daily_marks[' + j + ']', reason: 'date must be YYYY-MM-DD and loaned_market_value_minor/collateral_value_minor non-negative integers within range', supplied: loan_id });
        continue;
      }

      let daily_net_minor;
      if (basis === 'rebate_basis') {
        const benchmark_rate_bps = boundedInt(m.benchmark_rate_bps, MAX_RATE_BPS);
        const rebate_spread_bps = boundedInt(m.rebate_spread_bps, MAX_RATE_BPS);
        if (benchmark_rate_bps === null || rebate_spread_bps === null) {
          rejected_inputs.push({ where: 'loans[' + i + '].daily_marks[' + j + ']', reason: 'rebate_basis requires benchmark_rate_bps and rebate_spread_bps as non-negative integers within range', supplied: loan_id });
          continue;
        }
        daily_net_minor = -roundDiv(collateral_value_minor * (benchmark_rate_bps - rebate_spread_bps), ACCRUAL_DENOM);
      } else {
        const fee_rate_bps = boundedInt(m.fee_rate_bps, MAX_RATE_BPS);
        if (fee_rate_bps === null) {
          rejected_inputs.push({ where: 'loans[' + i + '].daily_marks[' + j + ']', reason: 'fee_basis requires fee_rate_bps as a non-negative integer within range', supplied: loan_id });
          continue;
        }
        daily_net_minor = roundDiv(loaned_market_value_minor * fee_rate_bps, ACCRUAL_DENOM);
      }

      const required_collateral_minor = ceilDiv(loaned_market_value_minor * required_margin_pct, 100);
      const mark_ok = collateral_value_minor >= required_collateral_minor;
      if (!mark_ok) breach_days.push({ date, collateral_value_minor, required_collateral_minor, shortfall_minor: required_collateral_minor - collateral_value_minor });

      computed_total_minor += daily_net_minor;
      daily_marks.push({ date, loaned_market_value_minor, collateral_value_minor, required_collateral_minor, mark_ok, daily_net_minor });
    }
    if (marksIn.length > MAX_DAYS_PER_LOAN) rejected_inputs.push({ where: 'loans[' + i + '].daily_marks', reason: 'more than ' + MAX_DAYS_PER_LOAN + ' daily marks supplied', supplied: loan_id });
    if (daily_marks.length === 0) { rejected_inputs.push({ where: 'loans[' + i + '].daily_marks', reason: 'absent or empty -- at least one daily mark is required to accrue a loan', supplied: loan_id }); continue; }

    const diff_minor = computed_total_minor - statement_amount_minor;
    const matches = Math.abs(diff_minor) <= diff_tolerance_minor;
    const worst_breach = breach_days.reduce((worst, b) => (!worst || b.shortfall_minor > worst.shortfall_minor) ? b : worst, null);

    seenLoans.set(loan_id, true);
    loans.push({
      loan_id, basis, day_count: daily_marks.length, daily_marks,
      computed_total_minor, statement_amount_minor, diff_minor, matches,
      collateral_breach_count: breach_days.length,
      worst_breach_date: worst_breach ? worst_breach.date : null,
      worst_shortfall_minor: worst_breach ? worst_breach.shortfall_minor : 0,
    });
  }
  if (loansIn.length > MAX_LOANS) rejected_inputs.push({ where: 'loans', reason: 'more than ' + MAX_LOANS + ' loans supplied', supplied: loansIn.length });
  if (loans.length === 0) rejected_inputs.push({ where: 'loans', reason: 'absent or empty -- at least one loan is required for the statement diff', supplied: null });

  const requiredMissing = !periodValid || loans.length === 0;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', { statement_period, diff_tolerance_minor, required_margin_pct, loan_count: loans.length, rejected_inputs }, ['SECLEND_REQUIRED_INPUTS_INCOMPLETE']);
  }

  // -- Findings.
  const findings = [];
  for (const loan of loans) {
    if (!loan.matches) {
      findings.push({ code: 'STATEMENT_AMOUNT_DIVERGES', severity: 'high', loan_id: loan.loan_id, message: 'Loan ' + loan.loan_id + ' computed total ' + loan.computed_total_minor + ' diverges from statement ' + loan.statement_amount_minor + ' by ' + loan.diff_minor + ' minor units.' });
    }
    if (loan.collateral_breach_count > 0) {
      findings.push({ code: 'COLLATERAL_MARK_BREACH', severity: 'high', loan_id: loan.loan_id, message: 'Loan ' + loan.loan_id + ' fell below the ' + required_margin_pct + '% collateral maintenance requirement on ' + loan.collateral_breach_count + ' day(s), worst shortfall ' + loan.worst_shortfall_minor + ' minor units on ' + loan.worst_breach_date + '.' });
    }
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const verdict = hasHigh ? 'DIVERGES' : 'MATCHES';
  const gate_policy = hasHigh ? 'review_required' : 'auto_pass';

  const compliance_flags = ['SECLEND_REBATE_FEE_RECOMPUTE_EVALUATED'];
  if (loans.some((l) => !l.matches)) compliance_flags.push('SECLEND_STATEMENT_AMOUNT_DIVERGES');
  if (loans.some((l) => l.collateral_breach_count > 0)) compliance_flags.push('SECLEND_COLLATERAL_MARK_BREACH');
  if (loans.some((l) => l.basis === 'fee_basis')) compliance_flags.push('SECLEND_FEE_BASIS_LOAN_PRESENT');
  if (loans.some((l) => l.basis === 'rebate_basis')) compliance_flags.push('SECLEND_REBATE_BASIS_LOAN_PRESENT');
  if (rejected_inputs.length > 0) compliance_flags.push('SECLEND_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      verdict, statement_period, diff_tolerance_minor, required_margin_pct,
      loan_count: loans.length, loans, findings, rejected_inputs,
      scope_note: SCOPE_NOTE, clause_note: CLAUSE_NOTE,
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
