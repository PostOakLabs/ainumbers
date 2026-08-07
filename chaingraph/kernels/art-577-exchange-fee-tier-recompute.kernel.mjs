import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-577-exchange-fee-tier-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_exchange_fee_tier_invoice',
  mandate_type: 'compliance_control', gpu: false,
};

// Exchange access-fee / maker-taker tier invoice recompute (art-577).
//
// WHAT IT ENFORCES. A trading firm receives a monthly invoice from an exchange built from a
// published maker-taker fee schedule: which tier the firm qualifies for (set by the firm's prior
// -period average daily volume), and the maker rebate / taker access-fee rate that tier attaches
// to every maker or taker share the firm traded that month. The schedule and the volume are both
// public/caller-known facts, so the invoice is recomputable arithmetic, not a black box. This
// kernel reruns that arithmetic against a caller-pasted schedule and caller-declared monthly
// volume, and diffs the result against the amount the exchange actually invoiced.
//
// TWO INDEPENDENT CHECKS, NOT ONE DISPLAY. (a) invoice recompute: resolve the firm's active tier
// from its declared prior-period ADV, apply that tier's maker/taker rates to the declared monthly
// maker/taker share totals, and diff the result against the claimed invoice amount within a
// declared tolerance -- MATCHES | DIVERGES | INDETERMINATE. (b) Rule 610(c) access-fee-cap
// conformance: independently checks every tier's taker (access-fee) rate in the declared schedule
// against the $0.001/share cap, regardless of which tier is currently active -- CAP_CONFORMANT |
// CAP_EXCEEDS | INDETERMINATE. The two checks do not gate each other: a schedule can conform to
// the cap while its invoice diverges, or vice versa.
//
// SCOPE. Fee schedules and volume are CALLER-DECLARED inputs. This kernel does not source, fetch,
// or maintain any exchange's published schedule -- there is no live schedule table here, and none
// is ever added; the caller pastes the schedule that applies to them.
//
// CLAUSE. Regulation NMS Rule 610(c), as amended by the SEC's access-fee-cap rule (adopted
// 2024-09-18, effective for quotations priced at $1.00/share or more; compliance date extended by
// SEC order to 2026-11-02 following the D.C. Circuit's 2025 review, which upheld the cap while
// vacating a separate provision). The $0.001/share cap applies only to protected quotations priced
// at $1.00 or more; sub-dollar securities are governed by a different formula (0.1% of the
// quotation price) which this kernel does not evaluate -- the caller declares whether the schedule
// applies to quotes priced at $1.00/share or more, and the cap check is INDETERMINATE otherwise.
//
// TOLERANCE AND APPLICABILITY ARE DECLARED INPUTS, NEVER DEFAULTS. An unstated tolerance would
// turn every rounding difference into a divergence, so its absence emits the did-not-run outcome
// with a reason rather than a silent zero. An undeclared cap-applicability flag never defaults to
// either true or false -- it emits INDETERMINATE rather than guessing which fee formula governs.
//
// MICRO-DOLLAR UNITS. Every rate and every money amount is an integer number of micro-dollars
// (1 micro = $0.000001), so a $0.001/share cap is exactly 1000 micros and every operation here is
// exact integer arithmetic -- no floating-point residue. Non-integer input is REJECTED rather than
// coerced.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_TIERS = 20;
const MAX_LINES = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CAP_MICROS_PER_SHARE = 1000; // $0.001/share, Reg NMS Rule 610(c) as amended.

function s(v) { return String(v == null ? '' : v).trim(); }

function safeInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function abs(n) { return n < 0 ? -n : n; }

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

const SCOPE_NOTE = 'Fee schedules, ADV, and monthly volume are caller-declared inputs. Does not source, fetch, or maintain any exchange fee schedule; performs arithmetic only over what the caller pastes.';
const CLAUSE_NOTE = 'Regulation NMS Rule 610(c), as amended by the SEC access-fee-cap rule (adopted 2024-09-18), caps the access fee for a protected quotation priced at $1.00/share or more at $0.001/share; compliance date extended by SEC order to 2026-11-02 following the D.C. Circuit\'s 2025 review, which upheld the cap. Sub-dollar securities are governed by a different formula (0.1% of quotation price) that this kernel does not evaluate.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      invoice_verdict: 'INDETERMINATE',
      cap_verdict: 'INDETERMINATE',
      invoice_period: (extra && extra.invoice_period) || null,
      recompute_tolerance_micros: (extra && typeof extra.recompute_tolerance_micros === 'number') ? extra.recompute_tolerance_micros : null,
      prior_period_adv_shares: (extra && typeof extra.prior_period_adv_shares === 'number') ? extra.prior_period_adv_shares : null,
      fee_schedule_summary: null,
      tiers: [],
      active_tier: null,
      volume_summary: null,
      recomputed_invoice_micros: null,
      claimed_invoice_micros: (extra && typeof extra.claimed_invoice_micros === 'number') ? extra.claimed_invoice_micros : null,
      diff_micros: null,
      cap_check: null,
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
  const toleranceDeclared = pp.recompute_tolerance_micros !== undefined && pp.recompute_tolerance_micros !== null && pp.recompute_tolerance_micros !== '';
  const recompute_tolerance_micros = toleranceDeclared ? safeInt(pp.recompute_tolerance_micros) : null;
  if (!toleranceDeclared) {
    rejected_inputs.push({ where: 'recompute_tolerance_micros', reason: 'absent -- a tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('recompute_tolerance_not_declared', { rejected_inputs }, ['EXFEE_TOLERANCE_NOT_DECLARED']);
  }
  if (recompute_tolerance_micros === null || recompute_tolerance_micros < 0) {
    rejected_inputs.push({ where: 'recompute_tolerance_micros', reason: 'not a non-negative safe integer number of micro-dollars', supplied: typeof pp.recompute_tolerance_micros === 'number' ? pp.recompute_tolerance_micros : s(pp.recompute_tolerance_micros) });
    return emptyResult('recompute_tolerance_not_declared', { rejected_inputs }, ['EXFEE_TOLERANCE_NOT_DECLARED']);
  }

  // -- Invoice period.
  const periodIn = (pp.invoice_period && typeof pp.invoice_period === 'object') ? pp.invoice_period : {};
  const start_date = isDate(periodIn.start_date) ? periodIn.start_date : null;
  const end_date = isDate(periodIn.end_date) ? periodIn.end_date : null;
  if (!start_date) rejected_inputs.push({ where: 'invoice_period.start_date', reason: 'absent or not YYYY-MM-DD', supplied: periodIn.start_date === undefined ? null : s(periodIn.start_date) });
  if (!end_date) rejected_inputs.push({ where: 'invoice_period.end_date', reason: 'absent or not YYYY-MM-DD', supplied: periodIn.end_date === undefined ? null : s(periodIn.end_date) });
  if (start_date && end_date && start_date > end_date) rejected_inputs.push({ where: 'invoice_period', reason: 'start_date is after end_date', supplied: start_date + '..' + end_date });
  const periodValid = !!(start_date && end_date && start_date <= end_date);
  const invoice_period = periodValid ? { start_date, end_date } : null;

  // -- Prior-period ADV (declared, selects the tier).
  const adv = safeInt(pp.prior_period_adv_shares);
  if (adv === null || adv < 0) rejected_inputs.push({ where: 'prior_period_adv_shares', reason: 'absent or not a non-negative safe integer', supplied: null });

  // -- Fee schedule.
  const scheduleIn = (pp.fee_schedule && typeof pp.fee_schedule === 'object') ? pp.fee_schedule : {};
  const schedule_id = s(scheduleIn.schedule_id);
  const effective_date = isDate(scheduleIn.effective_date) ? scheduleIn.effective_date : null;
  const capApplicabilityDeclared = typeof scheduleIn.quotes_priced_ge_1usd === 'boolean';
  const quotes_priced_ge_1usd = capApplicabilityDeclared ? scheduleIn.quotes_priced_ge_1usd : null;
  if (!schedule_id) rejected_inputs.push({ where: 'fee_schedule.schedule_id', reason: 'absent', supplied: null });
  if (!effective_date) rejected_inputs.push({ where: 'fee_schedule.effective_date', reason: 'absent or not YYYY-MM-DD', supplied: scheduleIn.effective_date === undefined ? null : s(scheduleIn.effective_date) });
  if (!capApplicabilityDeclared) rejected_inputs.push({ where: 'fee_schedule.quotes_priced_ge_1usd', reason: 'absent -- must be declared true/false, never defaulted', supplied: null });

  const tiersIn = Array.isArray(scheduleIn.tiers) ? scheduleIn.tiers.slice(0, MAX_TIERS) : [];
  const tiers = [];
  const seenTierIds = new Map();
  const seenThresholds = new Map();
  for (let i = 0; i < tiersIn.length; i++) {
    const row = tiersIn[i] || {};
    const tier_id = s(row.tier_id);
    const min_adv_shares = safeInt(row.min_adv_shares);
    const maker_rate_micros_per_share = safeInt(row.maker_rate_micros_per_share);
    const taker_rate_micros_per_share = safeInt(row.taker_rate_micros_per_share);
    if (!tier_id) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].tier_id', reason: 'absent', supplied: null }); continue; }
    if (seenTierIds.has(tier_id)) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].tier_id', reason: 'duplicate tier_id', supplied: tier_id }); continue; }
    if (min_adv_shares === null || min_adv_shares < 0) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].min_adv_shares', reason: 'absent or not a non-negative safe integer', supplied: tier_id }); continue; }
    if (seenThresholds.has(min_adv_shares)) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].min_adv_shares', reason: 'duplicate min_adv_shares threshold', supplied: tier_id }); continue; }
    if (maker_rate_micros_per_share === null) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].maker_rate_micros_per_share', reason: 'absent or not an integer number of micro-dollars', supplied: tier_id }); continue; }
    if (taker_rate_micros_per_share === null) { rejected_inputs.push({ where: 'fee_schedule.tiers[' + i + '].taker_rate_micros_per_share', reason: 'absent or not an integer number of micro-dollars', supplied: tier_id }); continue; }
    seenTierIds.set(tier_id, true);
    seenThresholds.set(min_adv_shares, true);
    tiers.push({ tier_id, min_adv_shares, maker_rate_micros_per_share, taker_rate_micros_per_share });
  }
  if (tiersIn.length > MAX_TIERS) rejected_inputs.push({ where: 'fee_schedule.tiers', reason: 'more than ' + MAX_TIERS + ' tiers supplied', supplied: tiersIn.length });
  tiers.sort((a, b) => a.min_adv_shares - b.min_adv_shares);
  if (tiers.length === 0) rejected_inputs.push({ where: 'fee_schedule.tiers', reason: 'absent or empty -- at least one tier is required', supplied: null });

  // -- Monthly volume lines.
  const linesIn = Array.isArray(pp.volume_lines) ? pp.volume_lines.slice(0, MAX_LINES) : [];
  let maker_shares_total = 0;
  let taker_shares_total = 0;
  let line_count = 0;
  for (let i = 0; i < linesIn.length; i++) {
    const row = linesIn[i] || {};
    const side = row.side === 'maker' || row.side === 'taker' ? row.side : null;
    const shares = safeInt(row.shares);
    if (!side || shares === null || shares <= 0) {
      rejected_inputs.push({ where: 'volume_lines[' + i + ']', reason: 'side must be maker/taker and shares a positive integer', supplied: row.side === undefined ? null : s(row.side) });
      continue;
    }
    if (side === 'maker') maker_shares_total += shares; else taker_shares_total += shares;
    line_count++;
  }
  if (linesIn.length > MAX_LINES) rejected_inputs.push({ where: 'volume_lines', reason: 'more than ' + MAX_LINES + ' volume lines supplied', supplied: linesIn.length });
  if (line_count === 0) rejected_inputs.push({ where: 'volume_lines', reason: 'absent or empty -- at least one volume line is required for the invoice recompute', supplied: null });

  // -- Claimed invoice amount.
  const claimed_invoice_micros = safeInt(pp.claimed_invoice_micros);
  if (claimed_invoice_micros === null) rejected_inputs.push({ where: 'claimed_invoice_micros', reason: 'absent or not an integer number of micro-dollars', supplied: null });

  const requiredMissing = !periodValid || adv === null || adv < 0 || !schedule_id || !effective_date
    || !capApplicabilityDeclared || tiers.length === 0 || line_count === 0 || claimed_invoice_micros === null;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', {
      invoice_period, recompute_tolerance_micros, prior_period_adv_shares: adv,
      claimed_invoice_micros, rejected_inputs,
    }, ['EXFEE_REQUIRED_INPUTS_INCOMPLETE']);
  }

  // -- (a) Invoice recompute: resolve the active tier from declared ADV.
  let active_tier = null;
  for (const t of tiers) {
    if (t.min_adv_shares <= adv) active_tier = t;
  }

  const volume_summary = { line_count, maker_shares_total, taker_shares_total };
  const fee_schedule_summary = { schedule_id, effective_date, tier_count: tiers.length, quotes_priced_ge_1usd };

  const findings = [];
  let invoice_verdict, recomputed_invoice_micros = null, diff_micros = null;
  if (!active_tier) {
    invoice_verdict = 'INDETERMINATE';
    findings.push({ code: 'NO_TIER_QUALIFIES_FOR_DECLARED_ADV', severity: 'warning', message: 'Declared prior_period_adv_shares does not meet the lowest tier threshold in the schedule.' });
  } else {
    recomputed_invoice_micros = maker_shares_total * active_tier.maker_rate_micros_per_share
      + taker_shares_total * active_tier.taker_rate_micros_per_share;
    diff_micros = recomputed_invoice_micros - claimed_invoice_micros;
    invoice_verdict = abs(diff_micros) <= recompute_tolerance_micros ? 'MATCHES' : 'DIVERGES';
    if (invoice_verdict === 'DIVERGES') {
      findings.push({ code: 'INVOICE_RECOMPUTE_DIVERGES', severity: 'high', message: 'Recomputed invoice (' + recomputed_invoice_micros + ' micros) differs from the claimed invoice (' + claimed_invoice_micros + ' micros) by more than the declared tolerance.' });
    }
  }

  // -- (b) Rule 610(c) access-fee-cap conformance, independent of the active tier.
  let cap_verdict, cap_check;
  if (quotes_priced_ge_1usd !== true) {
    cap_verdict = 'INDETERMINATE';
    cap_check = { cap_micros_per_share: CAP_MICROS_PER_SHARE, quotes_priced_ge_1usd, tier_findings: [] };
    findings.push({ code: 'CAP_APPLICABILITY_NOT_CONFIRMED', severity: 'warning', message: 'quotes_priced_ge_1usd is not declared true -- Rule 610(c)\'s $0.001/share cap applies only to quotations priced at $1.00/share or more; sub-dollar pricing uses a different formula this kernel does not evaluate.' });
  } else {
    const tier_findings = tiers.map((t) => ({
      tier_id: t.tier_id,
      taker_rate_micros_per_share: t.taker_rate_micros_per_share,
      exceeds_cap: t.taker_rate_micros_per_share > CAP_MICROS_PER_SHARE,
    }));
    const anyExceeds = tier_findings.some((f) => f.exceeds_cap);
    cap_verdict = anyExceeds ? 'CAP_EXCEEDS' : 'CAP_CONFORMANT';
    cap_check = { cap_micros_per_share: CAP_MICROS_PER_SHARE, quotes_priced_ge_1usd, tier_findings };
    if (anyExceeds) {
      const bad = tier_findings.filter((f) => f.exceeds_cap).map((f) => f.tier_id).join(', ');
      findings.push({ code: 'ACCESS_FEE_CAP_EXCEEDED', severity: 'high', message: 'Tier(s) ' + bad + ' declare a taker rate above the $0.001/share Rule 610(c) cap.' });
    }
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const gate_policy = hasHigh ? 'review_required' : 'auto_pass';

  const compliance_flags = ['EXFEE_INVOICE_AND_CAP_EVALUATED'];
  if (invoice_verdict === 'DIVERGES') compliance_flags.push('EXFEE_INVOICE_DIVERGES');
  if (invoice_verdict === 'INDETERMINATE') compliance_flags.push('EXFEE_TIER_NOT_RESOLVED');
  if (cap_verdict === 'CAP_EXCEEDS') compliance_flags.push('EXFEE_CAP_EXCEEDED');
  if (cap_verdict === 'INDETERMINATE') compliance_flags.push('EXFEE_CAP_APPLICABILITY_UNCONFIRMED');
  if (rejected_inputs.length > 0) compliance_flags.push('EXFEE_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      invoice_verdict,
      cap_verdict,
      invoice_period,
      recompute_tolerance_micros,
      prior_period_adv_shares: adv,
      fee_schedule_summary,
      tiers,
      active_tier,
      volume_summary,
      recomputed_invoice_micros,
      claimed_invoice_micros,
      diff_micros,
      cap_check,
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
