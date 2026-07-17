import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-332-build-amortization-schedule';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_amortization_schedule',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Deterministic amortization schedule builder, 12 CFR 1026 Appendix J (Reg Z).
// Cents-integer fixed-point discipline throughout (house discipline: no float
// drift in money math). Pure ECMA-262 arithmetic only -- no Math.pow, no
// Math.log*, no Date.now/new Date()/Math.random. Compounding uses integer-period
// loop multiplication (never Math.pow), because amortization needs no
// transcendental functions -- only integer-period loops and arithmetic. This is
// the upstream schedule feed for compute_reg_z_appendix_j_apr (art-215): it
// emits advances[]/payments[] in the exact shape art-215 already consumes.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function toCents(dollars) { return Math.round(safeNum(dollars, 0) * 100); }
function fromCents(cents) { return Number.isFinite(cents) ? Math.round(cents) / 100 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

// (1+rate)^n via integer-period loop multiplication. n MUST be a non-negative
// integer count of periods -- never a fractional exponent (that would need
// Math.pow/exp/ln, which amortization schedules never require).
function compoundFactor(periodicRate, n) {
  let f = 1;
  const steps = Math.max(0, Math.round(safeNum(n, 0)));
  for (let k = 0; k < steps; k++) f *= (1 + periodicRate);
  return f;
}

// Standard level-payment amount (integer cents) fully amortizing principalCents
// at periodicRate over n periods. General annuity-payment formula; f = (1+i)^n
// computed via compoundFactor (loop), never Math.pow.
function levelPaymentCents(principalCents, periodicRate, n) {
  const steps = Math.max(1, Math.round(safeNum(n, 1)));
  if (Math.abs(periodicRate) < 1e-12) return Math.round(principalCents / steps);
  const f = compoundFactor(periodicRate, steps);
  if (!Number.isFinite(f) || f <= 1) return Math.round(principalCents / steps);
  const principalDollars = principalCents / 100;
  const paymentDollars = principalDollars * periodicRate * f / (f - 1);
  return Number.isFinite(paymentDollars) ? Math.round(paymentDollars * 100) : Math.round(principalCents / steps);
}

// Generic fixed-periodic-rate amortization loop (level_payment / interest_only /
// balloon's inner nominal-schedule math all reduce to this). ioPeriods = leading
// interest-only periods (0 for standard level-payment). trueUpFinal forces the
// last period to zero any residual cent drift from payment rounding -- MUST be
// false for balloon (its whole point is a nonzero remaining balance at nPeriods,
// which the caller then rolls into an explicit balloon lump-sum payment).
function amortizeCents(principalCents, periodicRate, paymentCents, nPeriods, ioPeriods = 0, trueUpFinal = true) {
  const rows = [];
  let balance = Math.max(0, Math.round(principalCents));
  const steps = Math.max(1, Math.round(safeNum(nPeriods, 1)));
  const io = Math.max(0, Math.min(steps, Math.round(safeNum(ioPeriods, 0))));
  for (let k = 1; k <= steps; k++) {
    const interestCents = Math.round(balance * periodicRate);
    let principalPortion, pmt;
    if (k <= io) {
      principalPortion = 0;
      pmt = interestCents;
    } else {
      principalPortion = paymentCents - interestCents;
      if (principalPortion < 0) principalPortion = 0; // never negative-amortize the level_payment/IO/balloon paths
      if (principalPortion > balance) principalPortion = balance; // rounding true-up: never overpay principal
      if (trueUpFinal && k === steps) principalPortion = balance; // final-period true-up: zero the residual cent drift
      pmt = interestCents + principalPortion;
    }
    balance -= principalPortion;
    if (balance < 0) balance = 0;
    rows.push({ period_index: k, interest_cents: interestCents, principal_cents: principalPortion, payment_cents: pmt, ending_balance_cents: balance });
  }
  return { rows, ending_balance_cents: balance };
}

// ARM rate path: initial fixed period at note_rate_pct, then resets at each
// entry in rate_changes[] (period_index -> new index observation). Effective
// rate = index_value_pct + margin_pct, bounded by the periodic cap (vs the
// immediately prior effective rate) and the lifetime cap/floor (vs the initial
// note rate). rate_changes[].period_index is the FIRST period the new rate
// applies to (no live index fetching -- the caller supplies the resolved index
// values it observed at the contractual lookback point).
function buildArmSchedule(pp, principalCents, notePeriodicRate, numPayments, periodsPerYear, noteRatePct, compliance_flags) {
  const margin_pct = safeNum(pp.margin_pct, 0);
  const periodic_cap_pct = Math.max(0, safeNum(pp.periodic_cap_pct, 999));
  const lifetime_cap_pct = Math.max(0, safeNum(pp.lifetime_cap_pct, 999));
  const lifetime_floor_pct = safeNum(pp.lifetime_floor_pct, -999);
  const recast = pp.recast === false ? false : true; // default: recast (amortize remaining balance/term at every reset)
  const rawChanges = Array.isArray(pp.rate_changes) ? pp.rate_changes : [];
  const changes = rawChanges
    .map((c) => ({ period_index: Math.max(1, Math.round(safeNum(c && c.period_index, 1))), index_value_pct: safeNum(c && c.index_value_pct, noteRatePct - margin_pct) }))
    .sort((a, b) => a.period_index - b.period_index);

  const rows = [];
  let balance = Math.max(0, Math.round(principalCents));
  let currentRatePct = noteRatePct;
  let currentPeriodicRate = notePeriodicRate;
  let currentPaymentCents = levelPaymentCents(balance, currentPeriodicRate, numPayments);
  let changeIdx = 0;
  const rate_reset_log = [];

  for (let k = 1; k <= numPayments; k++) {
    // Apply any reset scheduled to take effect at this period.
    while (changeIdx < changes.length && changes[changeIdx].period_index === k) {
      const chg = changes[changeIdx];
      let uncapped = chg.index_value_pct + margin_pct;
      // periodic cap: bound the move from the prior effective rate
      let capped = uncapped;
      if (capped > currentRatePct + periodic_cap_pct) capped = currentRatePct + periodic_cap_pct;
      if (capped < currentRatePct - periodic_cap_pct) capped = currentRatePct - periodic_cap_pct;
      // lifetime cap/floor: bound relative to the initial note rate
      if (capped > noteRatePct + lifetime_cap_pct) capped = noteRatePct + lifetime_cap_pct;
      if (capped < noteRatePct + lifetime_floor_pct) capped = noteRatePct + lifetime_floor_pct;
      if (capped !== uncapped) compliance_flags.push('ARM_RATE_CAPPED_AT_PERIOD_' + k);
      currentRatePct = r6(capped);
      currentPeriodicRate = currentRatePct / 100 / periodsPerYear;
      rate_reset_log.push({ period_index: k, index_value_pct: chg.index_value_pct, margin_pct, uncapped_rate_pct: r6(uncapped), effective_rate_pct: currentRatePct });
      const remaining = numPayments - k + 1;
      if (recast) {
        currentPaymentCents = levelPaymentCents(balance, currentPeriodicRate, remaining);
      }
      changeIdx++;
    }

    const interestCents = Math.round(balance * currentPeriodicRate);
    let principalPortion = currentPaymentCents - interestCents;
    if (principalPortion < 0) {
      // Non-recast payment below the interest due -- negative amortization.
      // Deferred interest capitalizes into the balance (principalPortion stays
      // negative here so `balance -= principalPortion` below grows the balance).
      compliance_flags.push('ARM_NEGATIVE_AMORTIZATION_PERIOD_' + k);
    }
    if (principalPortion > balance) principalPortion = balance;
    if (k === numPayments && principalPortion < balance) {
      // final-period true-up so a recast schedule always reaches zero
      principalPortion = balance;
    }
    const pmt = interestCents + principalPortion;
    balance -= principalPortion;
    if (balance < 0) balance = 0;
    rows.push({ period_index: k, interest_cents: interestCents, principal_cents: principalPortion, payment_cents: pmt, ending_balance_cents: balance, rate_pct: currentRatePct });
  }

  return { rows, ending_balance_cents: balance, extra: { recast, rate_reset_log, initial_rate_pct: r6(noteRatePct) } };
}

// Temporary buydown (2-1 / 3-2-1, or a caller-declared custom schedule). NOTE:
// 12 CFR 1026 Appendix J does not define "buydown" -- this is a schedule-
// construction convenience layered on top of App J amortization, not itself an
// App J concept. Modeling convention (documented for reviewability): the loan
// amortizes on the FULL note-rate level-payment schedule for its whole term
// (that schedule is what the schedule[]/advances/payments arrays below carry --
// principal reduction never depends on the buydown). A temporary buydown is
// modeled as an escrowed subsidy: during buydown years the borrower pays a
// reduced amount computed via the standard level-payment formula at
// (note_rate - year's point reduction) amortized over the SAME original term
// (the conventional buydown-payment-table method); the subsidy account covers
// the difference each period so the lender still receives the full note payment.
// buydown_subsidy_schedule[] reports that split; it is NOT part of the
// execution_hash-bearing principal/interest schedule.
function buildBuydownReductions(pp) {
  const t = typeof pp.buydown_type === 'string' ? pp.buydown_type : '2-1';
  if (Array.isArray(pp.buydown_schedule) && pp.buydown_schedule.length > 0) {
    const map = {};
    for (const e of pp.buydown_schedule) {
      const y = Math.max(1, Math.round(safeNum(e && e.year_index, 1)));
      map[y] = Math.max(0, safeNum(e && e.reduction_pct, 0));
    }
    return map;
  }
  if (t === '3-2-1') return { 1: 3, 2: 2, 3: 1 };
  return { 1: 2, 2: 1 }; // default: 2-1
}

export function compute(pp) {
  pp = pp || {};
  const schedule_type = ['level_payment', 'arm', 'interest_only', 'balloon', 'temp_buydown'].includes(pp.schedule_type) ? pp.schedule_type : 'level_payment';
  const loan_amount = Math.max(0, safeNum(pp.loan_amount, 0));
  const principalCents = toCents(loan_amount);
  const periods_per_year = Math.max(1, Math.round(safeNum(pp.periods_per_year, 12)));
  const num_payments = Math.max(1, Math.round(safeNum(pp.num_payments, 1)));
  const odd_days = Math.max(0, safeNum(pp.odd_days, 0));
  const unit_period_days = Math.max(1, safeNum(pp.unit_period_days, 30));
  const odd_frac = odd_days / unit_period_days; // App J unit-period odd-days fraction (u)
  const note_rate_pct = safeNum(pp.note_rate_pct, 0);
  const note_periodic_rate = note_rate_pct / 100 / periods_per_year;

  const compliance_flags = [];
  let rows = [];
  let ending_balance_cents = principalCents;
  const extra = {};
  let buydown_subsidy_schedule;

  if (schedule_type === 'level_payment') {
    const paymentCents = (pp.payment_amount != null && Number.isFinite(safeNum(pp.payment_amount, null)))
      ? toCents(pp.payment_amount)
      : levelPaymentCents(principalCents, note_periodic_rate, num_payments);
    const res = amortizeCents(principalCents, note_periodic_rate, paymentCents, num_payments, 0);
    rows = res.rows; ending_balance_cents = res.ending_balance_cents;
    extra.payment_amount = fromCents(paymentCents);
  } else if (schedule_type === 'interest_only') {
    const io_periods = Math.max(0, Math.min(num_payments - 1, Math.round(safeNum(pp.io_periods, 0))));
    const amortizing_periods = num_payments - io_periods;
    const paymentCents = amortizing_periods > 0 ? levelPaymentCents(principalCents, note_periodic_rate, amortizing_periods) : principalCents;
    const res = amortizeCents(principalCents, note_periodic_rate, paymentCents, num_payments, io_periods);
    rows = res.rows; ending_balance_cents = res.ending_balance_cents;
    extra.io_periods = io_periods; extra.amortizing_periods = amortizing_periods; extra.amortizing_payment_amount = fromCents(paymentCents);
  } else if (schedule_type === 'balloon') {
    const nominal_amortization_periods = Math.max(num_payments, Math.round(safeNum(pp.nominal_amortization_periods, num_payments)));
    const paymentCents = levelPaymentCents(principalCents, note_periodic_rate, nominal_amortization_periods);
    const res = amortizeCents(principalCents, note_periodic_rate, paymentCents, num_payments, 0, false);
    rows = res.rows;
    const balloon_cents = res.ending_balance_cents;
    if (rows.length > 0 && balloon_cents > 0) {
      const last = rows[rows.length - 1];
      last.principal_cents += balloon_cents;
      last.payment_cents += balloon_cents;
      last.ending_balance_cents = 0;
    }
    ending_balance_cents = 0;
    extra.nominal_amortization_periods = nominal_amortization_periods;
    extra.regular_payment_amount = fromCents(paymentCents);
    extra.balloon_payment_amount = fromCents(balloon_cents);
  } else if (schedule_type === 'arm') {
    const armRes = buildArmSchedule(pp, principalCents, note_periodic_rate, num_payments, periods_per_year, note_rate_pct, compliance_flags);
    rows = armRes.rows; ending_balance_cents = armRes.ending_balance_cents;
    extra.recast = armRes.extra.recast;
    extra.rate_reset_log = armRes.extra.rate_reset_log;
    extra.initial_rate_pct = armRes.extra.initial_rate_pct;
  } else if (schedule_type === 'temp_buydown') {
    const notePaymentCents = levelPaymentCents(principalCents, note_periodic_rate, num_payments);
    const res = amortizeCents(principalCents, note_periodic_rate, notePaymentCents, num_payments, 0);
    rows = res.rows; ending_balance_cents = res.ending_balance_cents;
    extra.note_payment_amount = fromCents(notePaymentCents);

    const reductions = buildBuydownReductions(pp);
    buydown_subsidy_schedule = [];
    for (let k = 1; k <= num_payments; k++) {
      const year = Math.ceil(k / periods_per_year);
      const reduction = reductions[year] || 0;
      let borrowerPaymentCents = notePaymentCents;
      if (reduction > 0) {
        const reducedRate = Math.max(0, note_rate_pct - reduction) / 100 / periods_per_year;
        borrowerPaymentCents = levelPaymentCents(principalCents, reducedRate, num_payments);
      }
      const subsidyCents = Math.max(0, notePaymentCents - borrowerPaymentCents);
      buydown_subsidy_schedule.push({
        period_index: k,
        year,
        reduction_pct: reduction,
        borrower_payment_amount: fromCents(borrowerPaymentCents),
        subsidy_amount: fromCents(subsidyCents),
      });
    }
    extra.buydown_type = typeof pp.buydown_type === 'string' ? pp.buydown_type : '2-1';
  }

  // Finite gate: no NaN/Infinity may ever leave this kernel.
  for (const r of rows) {
    if (!Number.isFinite(r.interest_cents)) r.interest_cents = 0;
    if (!Number.isFinite(r.principal_cents)) r.principal_cents = 0;
    if (!Number.isFinite(r.payment_cents)) r.payment_cents = 0;
    if (!Number.isFinite(r.ending_balance_cents)) r.ending_balance_cents = 0;
  }

  const schedule = rows.map((r) => ({
    period_index: r.period_index,
    periods_from_consummation: r2(odd_frac + r.period_index),
    payment_amount: fromCents(r.payment_cents),
    principal: fromCents(r.principal_cents),
    interest: fromCents(r.interest_cents),
    ending_balance: fromCents(r.ending_balance_cents),
  }));

  const total_interest = r2(rows.reduce((s, r) => s + r.interest_cents, 0) / 100);
  const total_principal = r2(rows.reduce((s, r) => s + r.principal_cents, 0) / 100);

  const advances = [{ amount: loan_amount, periods_from_consummation: 0 }];
  const payments = rows.map((r) => ({ amount: fromCents(r.payment_cents), periods_from_consummation: r2(odd_frac + r.period_index) }));

  if (Math.abs(fromCents(ending_balance_cents)) > 0.01) compliance_flags.push('SCHEDULE_DID_NOT_FULLY_AMORTIZE');
  if (rows.length !== num_payments) compliance_flags.push('SCHEDULE_LENGTH_MISMATCH');

  const output_payload = Object.assign({
    schedule_type,
    loan_amount: r2(loan_amount),
    note_rate_pct: r6(note_rate_pct),
    periods_per_year,
    num_payments: rows.length,
    odd_days,
    unit_period_days,
    schedule,
    totals: {
      total_interest,
      total_principal,
      num_payments: rows.length,
      ending_balance: fromCents(ending_balance_cents),
    },
    advances,
    payments,
    regulatory_basis: '12 CFR 1026 Appendix J (Reg Z general actuarial equation, unit-period and odd-days conventions). Buydown modeling (temp_buydown) is a schedule-construction convenience, not an Appendix J concept.',
    note: 'Odd-days fraction shifts periods_from_consummation for the first period per Appendix J unit-period convention; it does not change per-period interest/principal allocation. Feed advances/payments directly into compute_reg_z_appendix_j_apr (art-215) for an actuarial APR on this schedule.',
  }, extra);

  if (buydown_subsidy_schedule) output_payload.buydown_subsidy_schedule = buydown_subsidy_schedule;

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // schedule_digest: a sub-hash over just the schedule[] array, reusing the vetted
  // executionHash canonicalizer (never a hand-rolled one) by pairing it with a fixed
  // marker object instead of a real output_payload -- same convention as art-350's
  // file_digest/per_record_findings_digest auxiliary digests.
  const schedule_digest = await executionHash(output_payload.schedule, { digest_marker: TOOL_ID });
  output_payload.schedule_digest = 'sha256:' + schedule_digest;

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
