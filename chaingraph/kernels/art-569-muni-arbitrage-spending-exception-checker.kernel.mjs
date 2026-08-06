import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-569-muni-arbitrage-spending-exception-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_muni_arbitrage_spending_exception',
  mandate_type: 'compliance_control', gpu: false,
};

// Muni arbitrage spending-exception checker (art-569).
//
// SCOPE. Tests ONLY whether a tax-exempt bond issue satisfies one of the IRC section 148
// arbitrage-rebate SPENDING EXCEPTIONS -- the 6-month, 18-month, or 24-month (construction)
// milestone schedule under Treas. Reg. section 1.148-7. It does NOT compute the future-value
// arbitrage rebate itself; that is a deliberately separate, not-yet-built tool. Satisfying a
// spending exception means the issue is not required to compute or pay rebate on the proceeds
// covered by the exception -- nothing more, and this kernel makes no claim beyond that.
//
// THE THREE SCHEDULES, BUILT-IN AND DATED. Percentages are cumulative gross-proceeds spent as
// of each milestone, measured from the issue date:
//   6_MONTH  (1.148-7(c)):  6mo=100%                         (with reasonable retainage: 6mo=95%, 12mo=100%)
//   18_MONTH (1.148-7(d)):  6mo=15%, 12mo=60%, 18mo=100%      (with reasonable retainage: 18mo=95%, 30mo=100%)
//   24_MONTH (1.148-7(e)):  6mo=10%, 12mo=45%, 18mo=75%, 24mo=100% (with reasonable retainage: 24mo=95%, 36mo=100%)
// `reasonable_retainage` is a caller-declared boolean, never assumed -- electing it swaps in the
// retainage variant of the elected exception's schedule, which is what the regulation itself does.
//
// DE MINIMIS. Treas. Reg. section 1.148-7 allows a small unspent amount -- not exceeding the LESSER of
// 3% of the issue price or $150,000 -- to be disregarded at a milestone without failing it. The
// caller declares the exact minor-unit amount they are relying on (never a percentage the kernel
// guesses); the kernel REJECTS an out-of-range declaration rather than clamp it silently.
//
// MILESTONE VERDICTS. Each milestone gets exactly one of MET, FAILED, or PENDING. A milestone whose
// date is still in the future relative to the caller-declared evaluation date (`as_of_date`) is
// PENDING -- it has not failed, because it has not yet had its chance to be met. A milestone whose
// date has passed is MET if cumulative spending (net of any declared de minimis) reached the
// required amount, else FAILED. Overall exception status is FAILED if any milestone FAILED, else
// PENDING if any milestone is still PENDING, else MET only when every milestone MET.
//
// MONTH ARITHMETIC. A milestone N months after the issue date is computed calendar-wise (same
// day-of-month N months later, clamped to the shorter month's last day when the issue date falls on
// a day that does not exist in the target month) -- not a fixed 30-day approximation, since the
// regulation's "6 months" is a calendar date, not a day count.
//
// CLAUSE. IRC section 148; Treas. Reg. section 1.148-7; IRS Pub 5271 (Tax Exempt Bonds: Arbitrage
// Rebate compliance overview). Not tax advice. Meeting a spending exception under the tests
// programmed here means only what the cited regulation says it means -- it does not itself resolve
// every fact question (e.g. whether an expenditure is a qualified capital expenditure) that the
// regulation also requires.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_EXPENDITURES = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXCEPTIONS = ['6_MONTH', '18_MONTH', '24_MONTH'];

function s(v) { return String(v == null ? '' : v).trim(); }

function minorInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Calendar-add N whole months to a YYYY-MM-DD date, clamping the day to the target month's last
// day when the source day does not exist there (e.g. Jan 31 + 1 month -> Feb 28/29).
function addMonths(dateStr, months) {
  const { y, m, day } = parseDate(dateStr);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(day, daysInMonth(ny, nm));
  return ny + '-' + String(nm).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
}

function cmpDate(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function scheduleFor(elected, reasonableRetainage) {
  if (elected === '6_MONTH') {
    return reasonableRetainage
      ? [{ months: 6, required_pct: 95 }, { months: 12, required_pct: 100 }]
      : [{ months: 6, required_pct: 100 }];
  }
  if (elected === '18_MONTH') {
    return reasonableRetainage
      ? [{ months: 6, required_pct: 15 }, { months: 12, required_pct: 60 }, { months: 18, required_pct: 95 }, { months: 30, required_pct: 100 }]
      : [{ months: 6, required_pct: 15 }, { months: 12, required_pct: 60 }, { months: 18, required_pct: 100 }];
  }
  // 24_MONTH
  return reasonableRetainage
    ? [{ months: 6, required_pct: 10 }, { months: 12, required_pct: 45 }, { months: 18, required_pct: 75 }, { months: 24, required_pct: 95 }, { months: 36, required_pct: 100 }]
    : [{ months: 6, required_pct: 10 }, { months: 12, required_pct: 45 }, { months: 18, required_pct: 75 }, { months: 24, required_pct: 100 }];
}

const SCOPE_NOTE = 'Tests ONLY whether the issue satisfies the elected spending exception milestone schedule under Treas. Reg. section 1.148-7. Does not compute the future-value arbitrage rebate; that is a separate, not-yet-built tool. Meeting a milestone means only what the cited regulation says it means.';
const CLAUSE_NOTE = 'IRC section 148 (Arbitrage); Treas. Reg. section 1.148-7 (Spending exceptions to the rebate requirement), specifically -7(c) 6-month, -7(d) 18-month, and -7(e) 24-month (construction) schedules including their reasonable-retainage variants; IRS Pub 5271 (Tax Exempt Bonds: Arbitrage Rebate compliance overview). Not tax advice -- confirm current text and facts with qualified bond counsel.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      overall_status: 'PENDING',
      elected_exception: (extra && extra.elected_exception) || null,
      reasonable_retainage: (extra && typeof extra.reasonable_retainage === 'boolean') ? extra.reasonable_retainage : null,
      issue_date: (extra && extra.issue_date) || null,
      as_of_date: (extra && extra.as_of_date) || null,
      gross_proceeds_minor: (extra && typeof extra.gross_proceeds_minor === 'number') ? extra.gross_proceeds_minor : null,
      de_minimis_minor: (extra && typeof extra.de_minimis_minor === 'number') ? extra.de_minimis_minor : null,
      de_minimis_cap_minor: (extra && typeof extra.de_minimis_cap_minor === 'number') ? extra.de_minimis_cap_minor : null,
      total_expenditures_minor: 0,
      milestones: [],
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

  const issue_date = isDate(pp.issue_date) ? pp.issue_date : null;
  if (!issue_date) rejected_inputs.push({ where: 'issue_date', reason: 'absent or not YYYY-MM-DD', supplied: pp.issue_date === undefined ? null : s(pp.issue_date) });

  const as_of_date = isDate(pp.as_of_date) ? pp.as_of_date : null;
  if (!as_of_date) rejected_inputs.push({ where: 'as_of_date', reason: 'absent or not YYYY-MM-DD -- an evaluation date is required to distinguish PENDING from FAILED milestones', supplied: pp.as_of_date === undefined ? null : s(pp.as_of_date) });

  const gross_proceeds_minor = minorInt(pp.gross_proceeds_minor);
  if (gross_proceeds_minor === null || gross_proceeds_minor <= 0) {
    rejected_inputs.push({ where: 'gross_proceeds_minor', reason: 'absent or not a positive integer number of minor units', supplied: pp.gross_proceeds_minor === undefined ? null : s(pp.gross_proceeds_minor) });
  }

  const elected_exception = EXCEPTIONS.includes(pp.elected_exception) ? pp.elected_exception : null;
  if (!elected_exception) rejected_inputs.push({ where: 'elected_exception', reason: 'absent or not one of 6_MONTH, 18_MONTH, 24_MONTH', supplied: pp.elected_exception === undefined ? null : s(pp.elected_exception) });

  const retainageDeclared = typeof pp.reasonable_retainage === 'boolean';
  if (!retainageDeclared) rejected_inputs.push({ where: 'reasonable_retainage', reason: 'absent -- whether reasonable retainage is elected must be declared as true/false, never defaulted', supplied: null });
  const reasonable_retainage = retainageDeclared ? pp.reasonable_retainage : null;

  // de minimis: optional, but if declared must not exceed the lesser of 3% of gross proceeds or
  // $150,000 (15,000,000 minor units).
  const de_minimis_declared = pp.de_minimis_minor !== undefined && pp.de_minimis_minor !== null && pp.de_minimis_minor !== '';
  let de_minimis_minor = 0;
  let de_minimis_cap_minor = null;
  if (gross_proceeds_minor !== null && gross_proceeds_minor > 0) {
    de_minimis_cap_minor = Math.min(Math.floor(gross_proceeds_minor * 0.03), 15000000);
  }
  if (de_minimis_declared) {
    const v = minorInt(pp.de_minimis_minor);
    if (v === null || v < 0) {
      rejected_inputs.push({ where: 'de_minimis_minor', reason: 'not a non-negative integer number of minor units', supplied: s(pp.de_minimis_minor) });
    } else if (de_minimis_cap_minor !== null && v > de_minimis_cap_minor) {
      rejected_inputs.push({ where: 'de_minimis_minor', reason: 'exceeds the lesser of 3% of gross proceeds or $150,000 (' + de_minimis_cap_minor + ' minor units)', supplied: v });
    } else {
      de_minimis_minor = v;
    }
  }

  // Expenditure schedule.
  const expIn = Array.isArray(pp.expenditure_schedule) ? pp.expenditure_schedule.slice(0, MAX_EXPENDITURES) : [];
  const expenditure_schedule = [];
  for (let i = 0; i < expIn.length; i++) {
    const row = expIn[i] || {};
    const date = isDate(row.date) ? row.date : null;
    const amount_minor = minorInt(row.amount_minor);
    if (!date || amount_minor === null || amount_minor <= 0) {
      rejected_inputs.push({ where: 'expenditure_schedule[' + i + ']', reason: 'date must be YYYY-MM-DD and amount_minor a positive integer number of minor units', supplied: row.date === undefined ? null : s(row.date) });
      continue;
    }
    expenditure_schedule.push({ date, amount_minor, description: s(row.description) });
  }
  if (expIn.length > MAX_EXPENDITURES) rejected_inputs.push({ where: 'expenditure_schedule', reason: 'more than ' + MAX_EXPENDITURES + ' expenditure rows supplied', supplied: expIn.length });

  const requiredMissing = !issue_date || !as_of_date || gross_proceeds_minor === null || gross_proceeds_minor <= 0
    || !elected_exception || !retainageDeclared;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', {
      elected_exception, reasonable_retainage, issue_date, as_of_date, gross_proceeds_minor, de_minimis_minor: de_minimis_declared ? de_minimis_minor : null, de_minimis_cap_minor, rejected_inputs,
    }, ['MUNI_SPEND_EXC_REQUIRED_INPUTS_INCOMPLETE']);
  }

  expenditure_schedule.sort((a, b) => cmpDate(a.date, b.date));
  const total_expenditures_minor = expenditure_schedule.reduce((acc, e) => acc + e.amount_minor, 0);

  const schedule = scheduleFor(elected_exception, reasonable_retainage);
  const milestones = [];
  for (const m of schedule) {
    const milestone_date = addMonths(issue_date, m.months);
    const cumulative_spent_minor = expenditure_schedule
      .filter((e) => cmpDate(e.date, milestone_date) <= 0)
      .reduce((acc, e) => acc + e.amount_minor, 0);
    const required_gross_minor = Math.ceil((m.required_pct / 100) * gross_proceeds_minor);
    const required_minor = Math.max(0, required_gross_minor - de_minimis_minor);
    const isFuture = cmpDate(milestone_date, as_of_date) > 0;
    let verdict;
    if (isFuture) verdict = 'PENDING';
    else verdict = cumulative_spent_minor >= required_minor ? 'MET' : 'FAILED';
    milestones.push({
      months_after_issue_date: m.months,
      milestone_date,
      required_pct: m.required_pct,
      required_gross_minor,
      required_minor,
      cumulative_spent_minor,
      verdict,
    });
  }

  const anyFailed = milestones.some((m) => m.verdict === 'FAILED');
  const anyPending = milestones.some((m) => m.verdict === 'PENDING');
  const overall_status = anyFailed ? 'FAILED' : anyPending ? 'PENDING' : 'MET';
  const gate_policy = overall_status === 'MET' ? 'auto_pass' : overall_status === 'FAILED' ? 'review_required' : 'review_required';

  const compliance_flags = ['MUNI_SPEND_EXC_MILESTONES_EVALUATED'];
  if (overall_status === 'FAILED') compliance_flags.push('MUNI_SPEND_EXC_MILESTONE_FAILED');
  if (overall_status === 'PENDING') compliance_flags.push('MUNI_SPEND_EXC_MILESTONE_PENDING');
  if (overall_status === 'MET') compliance_flags.push('MUNI_SPEND_EXC_ALL_MILESTONES_MET');
  if (de_minimis_minor > 0) compliance_flags.push('MUNI_SPEND_EXC_DE_MINIMIS_APPLIED');
  if (reasonable_retainage) compliance_flags.push('MUNI_SPEND_EXC_REASONABLE_RETAINAGE_ELECTED');
  if (rejected_inputs.length > 0) compliance_flags.push('MUNI_SPEND_EXC_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      overall_status,
      elected_exception,
      reasonable_retainage,
      issue_date,
      as_of_date,
      gross_proceeds_minor,
      de_minimis_minor: de_minimis_declared ? de_minimis_minor : null,
      de_minimis_cap_minor,
      total_expenditures_minor,
      milestones,
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
