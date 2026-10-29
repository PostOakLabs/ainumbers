import { executionHash } from './_hash.mjs';
// BNPL plan comparator (BNPL-COMPARATOR-NODE-1). The APR maths is NOT
// reimplemented here: every APR this node emits is computed by the estate's
// Reg Z Appendix J solver, art-215 (compute_reg_z_appendix_j_apr), imported
// and called below. This kernel builds BNPL payment streams (instalments,
// cadence, fees), hands them to art-215, and formats the side-by-side
// comparison. A row hard-STOP forbids an APR method diverging from art-215;
// delegation makes divergence structurally impossible.
import { compute as computeRegZApr } from './art-215-reg-z-appendix-j-apr.kernel.mjs';

const TOOL_ID = 'art-779-bnpl-plan-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_bnpl_plans',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ---------------------------------------------------------------------------
// Cadence table. Appendix J prices flows in UNIT PERIODS; the cadence maps to
// unit-periods per year for art-215's periods_per_year input (APR = periodic
// rate x unit-periods per year, the single-unit-period actuarial method).
export const CADENCES = {
  weekly:   { periods_per_year: 52 },
  biweekly: { periods_per_year: 26 },
  monthly:  { periods_per_year: 12 },
};

// ---------------------------------------------------------------------------
// Provider presets. Every preset is a LABELLED EXAMPLE quoted from a dated
// primary-text snapshot (row BNPL-TERMS-PRIMARY-TEXT-1); none is an offer, and
// every parameter a preset fills carries the clause that states it. A preset
// with no provider-published dollar example fills only the plan SHAPE and is
// applied to the caller's principal; a preset with a labelled example carries
// the provider's own amounts. Terms vary by provider, merchant and credit
// decision; the qualifier quotes are the providers' own.
export const SNAPSHOTS = {
  paypal:   { id: 'bnpl-paypal-2026-10',   path: 'research/clause-snapshots/bnpl-paypal-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
  klarna:   { id: 'bnpl-klarna-2026-10',   path: 'research/clause-snapshots/bnpl-klarna-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
  afterpay: { id: 'bnpl-afterpay-2026-10', path: 'research/clause-snapshots/bnpl-afterpay-2026-10/SNAPSHOT.md', fetched: '2026-10-28' },
  affirm:   { id: 'bnpl-affirm-2026-10',   path: 'research/clause-snapshots/bnpl-affirm-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
};

function cite(provider, clause_id, quote) {
  const s = SNAPSHOTS[provider];
  return { snapshot: s.id, snapshot_path: s.path, fetched: s.fetched, clause: clause_id, quote };
}

export const PRESETS = {
  paypal_pay_in_4: {
    provider: 'paypal', display: 'PayPal Pay in 4 (plan shape, biweekly)',
    kind: 'shape', // no provider-published dollar example on the fetched page
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('paypal', 'P1', 'Split your purchase into 4 interest-free, bi-weekly payments.'),
      cite('paypal', 'P1', 'First payment due at time of purchase. Three interest-free payments after.'),
      cite('paypal', 'P1', 'Pay in 4 is always interest-free, with no late fees or sign-up fees.'),
      cite('paypal', 'P1', 'Purchases from $10 to $2,000'),
    ],
    lender_note: cite('paypal', 'P1', 'The lender for Pay in 4 is PayPal, Inc. (NMLS# 910457).'),
    late_fee_note: cite('paypal', 'P1', 'Pay in 4 is always interest-free, with no late fees or sign-up fees.'),
    qualifiers: [cite('paypal', 'P1', 'Offer availability depends on the merchant and also may not be available for certain recurring, subscription services.')],
  },
  klarna_pay_in_4: {
    provider: 'klarna', display: 'Klarna Pay in 4 (plan shape, biweekly)',
    kind: 'shape',
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('klarna', 'K1', 'Pay in 4 allows you to split your purchase into 4 interest-free payments, paid every 2 weeks.'),
      cite('klarna', 'K1', 'The remaining three payments will be automatically charged every 2 weeks afterwards, with no interest or fees when you pay on time.'),
      cite('klarna', 'K1', 'No fees will be charged when you pay on time.'),
    ],
    late_fee_note: cite('klarna', 'K1', 'along with a late fee of up to $7.00.'),
    qualifiers: [cite('klarna', 'K1', 'The aggregate sum of your late fees will never exceed 25% of your order value at the time of purchase.')],
  },
  klarna_service_fee_example: {
    provider: 'klarna', display: 'Klarna apply-in-advance Pay in 4, labelled example (service fee)',
    kind: 'labelled_example', labelled_principal: 248,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 35.68,
      upfront_fee: 4.99, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [62, 62, 62, 62], // $62 down + three biweekly $62 (K2)
    },
    clauses: [
      cite('klarna', 'K2', 'Apply in advance for Pay in 4, issued by WebBank, with a service fee between $1.29\u2013$5.99.'),
      cite('klarna', 'K2', 'a $248 purchase with a $62 down payment and $4.99 service fee results in a 35.68% APR'),
      cite('klarna', 'K2', 'followed by three more biweekly payments of $62 (total repayment: $252.99).'),
    ],
    lender_note: cite('klarna', 'K2', 'Apply in advance for Pay in 4, issued by WebBank'),
    late_fee_note: cite('klarna', 'K1', 'along with a late fee of up to $7.00.'),
    qualifiers: [cite('klarna', 'K2', 'Subject to credit approval; minimum 25% down payment required.')],
  },
  afterpay_pay_in_4: {
    provider: 'afterpay', display: 'Afterpay Pay in 4 (plan shape, biweekly)',
    kind: 'shape',
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('afterpay', 'A1', 'Pay in 4 interest-free installments generally over six weeks at Afterpay brands.'),
      cite('afterpay', 'A1', 'Make the first payment upfront and the rest over time.'),
      cite('afterpay', 'A2', 'THERE ARE NO FINANCE CHARGES AND NO INTEREST PAYMENTS ASSOCIATED WITH THIS AGREEMENT.'),
    ],
    late_fee_note: cite('afterpay', 'A2', 'the Late Fee indicated in the Payment Schedule (if any) will be imposed, up to a maximum of $8.00'),
    qualifiers: [cite('afterpay', 'A1', 'Payment amounts shown are estimates and depend on eligibility and exclude taxes and shipping charges, which are added at checkout.')],
  },
  afterpay_finance_fee_example: {
    provider: 'afterpay', display: 'Afterpay finance-fee loan, labelled example',
    kind: 'labelled_example', labelled_principal: 110,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 36,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [27.5, 28.26, 28.26, 28.26], // $27.50 down, then 3 x $28.26; the finance fee is embedded (A1)
    },
    clauses: [
      cite('afterpay', 'A1', 'At a loan amount of $110 you could pay a down payment of $27.50'),
      cite('afterpay', 'A1', 'followed by 3 generally biweekly payments of $28.26 at a 36% APR.'),
      cite('afterpay', 'A1', 'if your loan has a finance fee, your annual percentage rate could be 36%'),
    ],
    lender_note: cite('afterpay', 'A1', 'Loans with a finance fee are underwritten and issued by First Electronic Bank.'),
    late_fee_note: cite('afterpay', 'A2', 'the Late Fee indicated in the Payment Schedule (if any) will be imposed, up to a maximum of $8.00'),
    qualifiers: [cite('afterpay', 'A1', 'Payment amounts shown are estimates and depend on eligibility and exclude taxes and shipping charges, which are added at checkout.')],
  },
  affirm_pay_in_4_example: {
    provider: 'affirm', display: 'Affirm Pay in 4, labelled example ($400)',
    kind: 'labelled_example', labelled_principal: 400,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [100, 100, 100, 100],
    },
    clauses: [
      cite('affirm', 'F1', 'Affirm Pay in 4 payment option is 0% APR.'),
      cite('affirm', 'F1', 'followed by 12 monthly payments of $28.88 at 15% APR or 4 interest-free payments of $100 every 2 weeks.'),
    ],
    late_fee_note: cite('affirm', 'F1', 'No fees. Ever.'),
    qualifiers: [cite('affirm', 'F1', 'Options depend on your purchase amount, may vary by merchant, and may not be available in all states.')],
  },
  affirm_monthly_example: {
    provider: 'affirm', display: 'Affirm monthly, labelled example ($400, 15% APR)',
    kind: 'labelled_example', labelled_principal: 400,
    params: {
      num_instalments: 12, cadence: 'monthly', stated_apr_pct: 15,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: false,
      down_payment: 80, instalment_amount: 28.88, // $80 down at purchase + 12 x $28.88 monthly (F1)
    },
    clauses: [
      cite('affirm', 'F1', 'For example, at a purchase price of $400 you could pay a down payment of $80'),
      cite('affirm', 'F1', 'followed by 12 monthly payments of $28.88 at 15% APR or 4 interest-free payments of $100 every 2 weeks.'),
      cite('affirm', 'F1', 'Your rate will be 0\u201336% APR based on credit, and is subject to an eligibility check.'),
    ],
    lender_note: cite('affirm', 'F2', 'Loans through Affirm are made by Cross River Bank, Member FDIC; Celtic Bank; Lead Bank, Member FDIC; or Affirm Loan Services, LLC.'),
    late_fee_note: cite('affirm', 'F1', 'No fees. Ever.'),
    qualifiers: [cite('affirm', 'F1', 'Options depend on your purchase amount, may vary by merchant, and may not be available in all states.')],
  },
};

// ---------------------------------------------------------------------------
// Domain caps (caller-controlled values are clamped or refused, never looped).
const PRINCIPAL_MAX = 1000000;   // USD 1,000,000
const INSTALMENTS_MIN = 1, INSTALMENTS_MAX = 156; // three years of weekly payments
const PLANS_MIN = 1, PLANS_MAX = 8;
const APR_PCT_MIN = 0, APR_PCT_MAX = 100;
const FEE_MAX = 100000;
const AMOUNT_MAX = 1000000;

function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function refused(domain_error, flags, detail) {
  return {
    output_payload: {
      input_echo: null, refused: true, domain_error,
      note: detail,
      apr_method: 'Reg Z Appendix J actuarial via art-215 compute_reg_z_appendix_j_apr (delegated, never reimplemented)',
    },
    compliance_flags: flags,
  };
}

const F = (name) => `ART779_${name}`;

// ---------------------------------------------------------------------------
// Resolve one plan entry into explicit schedule parameters.
function resolvePlan(plan, principal, idx) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { err: 'REFUSED_MALFORMED_PLAN', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] is not an object` };
  }
  const isPreset = plan.preset !== undefined && plan.preset !== null;
  const explicitKeys = ['num_instalments', 'cadence', 'stated_apr_pct', 'apr_pct', 'upfront_fee', 'per_instalment_fee', 'instalment_amount', 'instalments', 'down_payment', 'first_instalment_at_purchase'];
  const hasExplicit = explicitKeys.some((k) => plan[k] !== undefined && plan[k] !== null);
  if (isPreset && hasExplicit) {
    return { err: 'REFUSED_PRESET_AND_EXPLICIT', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries both preset and explicit plan fields; choose one` };
  }
  if (!isPreset && !hasExplicit) {
    return { err: 'REFUSED_EMPTY_PLAN', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries neither preset nor explicit plan fields` };
  }

  let p, preset = null;
  if (isPreset) {
    if (typeof plan.preset !== 'string' || !PRESETS[plan.preset]) {
      return { err: 'REFUSED_UNKNOWN_PRESET', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].preset ${JSON.stringify(plan.preset)} matches no snapshot-backed preset` };
    }
    preset = PRESETS[plan.preset];
    p = { ...preset.params };
  } else {
    p = {
      num_instalments: plan.num_instalments,
      cadence: plan.cadence,
      stated_apr_pct: plan.apr_pct !== undefined && plan.apr_pct !== null ? plan.apr_pct : plan.stated_apr_pct,
      upfront_fee: plan.upfront_fee ?? 0,
      per_instalment_fee: plan.per_instalment_fee ?? 0,
      instalments: plan.instalments,
      instalment_amount: plan.instalment_amount,
      down_payment: plan.down_payment ?? 0,
      first_instalment_at_purchase: plan.first_instalment_at_purchase === true,
    };
  }

  const n = Math.round(num(p.num_instalments) ?? NaN);
  if (!(n >= INSTALMENTS_MIN && n <= INSTALMENTS_MAX)) {
    return { err: 'REFUSED_INVALID_NUM_INSTALMENTS', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].num_instalments must be an integer ${INSTALMENTS_MIN} to ${INSTALMENTS_MAX}` };
  }
  if (typeof p.cadence !== 'string' || !CADENCES[p.cadence]) {
    return { err: 'REFUSED_UNKNOWN_CADENCE', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].cadence must be one of weekly, biweekly, monthly` };
  }
  const aprIn = num(p.stated_apr_pct) ?? 0;
  if (!(aprIn >= APR_PCT_MIN && aprIn <= APR_PCT_MAX)) {
    return { err: 'REFUSED_INVALID_APR', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] stated APR must be ${APR_PCT_MIN} to ${APR_PCT_MAX} percent` };
  }
  const upfrontFee = num(p.upfront_fee) ?? 0;
  const perInstFee = num(p.per_instalment_fee) ?? 0;
  const down = num(p.down_payment) ?? 0;
  if (!(upfrontFee >= 0 && upfrontFee <= FEE_MAX) || !(perInstFee >= 0 && perInstFee <= FEE_MAX) || !(down >= 0 && down <= AMOUNT_MAX)) {
    return { err: 'REFUSED_INVALID_FEE', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] fees and down payment must be numbers between 0 and their caps` };
  }

  // Instalment amounts (base principal components, fees added separately).
  let baseInstalments = null;
  if (Array.isArray(p.instalments)) {
    const arrOk = p.instalments.length === n && p.instalments.every((x) => { const v = num(x); return v !== null && v > 0 && v <= AMOUNT_MAX; });
    if (!arrOk) {
      return { err: 'REFUSED_INVALID_INSTALMENTS', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].instalments must be ${n} positive amounts` };
    }
    baseInstalments = p.instalments.map((x) => r2(num(x)));
  } else if (p.instalment_amount !== undefined && p.instalment_amount !== null) {
    const v = num(p.instalment_amount);
    if (v === null || !(v > 0 && v <= AMOUNT_MAX)) {
      return { err: 'REFUSED_INVALID_INSTALMENT_AMOUNT', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].instalment_amount must be a positive number` };
    }
    baseInstalments = Array(n).fill(r2(v));
  } else if (aprIn > 0) {
    // Interest-bearing custom plan with no quoted instalment: the comparator
    // prices the stream AS QUOTED; it never originates an amortizing schedule.
    return { err: 'REFUSED_INSTALMENT_AMOUNT_REQUIRED', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries a positive stated APR but no instalment_amount; enter the quoted instalment, this node compares quoted plans and does not originate one` };
  } else {
    // Interest-free plan: split the principal equally, last absorbs remainder.
    const pc = Math.round(principal * 100);
    const base = Math.floor(pc / n);
    baseInstalments = [];
    for (let k = 0; k < n - 1; k++) baseInstalments.push(base / 100);
    baseInstalments.push((pc - base * (n - 1)) / 100);
  }

  const label = typeof plan.label === 'string' && plan.label.trim()
    ? plan.label.trim().slice(0, 80)
    : (preset ? preset.display : `${n} ${p.cadence} instalments`);

  return {
    ok: true, label, n, cadence: p.cadence, statedApr: r2(aprIn),
    upfrontFee: r2(upfrontFee), perInstFee: r2(perInstFee), down: r2(down),
    firstAtPurchase: p.first_instalment_at_purchase === true,
    baseInstalments, presetId: isPreset ? plan.preset : null, preset,
  };
}

// ---------------------------------------------------------------------------
export function compute(pp) {
  pp = pp || {};

  const principal = num(pp.principal);
  if (principal === null || !(principal > 0 && principal <= PRINCIPAL_MAX)) {
    return refused('REFUSED_INVALID_PRINCIPAL', [F('INPUT_REFUSED')], `principal must be a number above 0 and at most ${PRINCIPAL_MAX}`);
  }
  if (pp.currency !== undefined && pp.currency !== null && pp.currency !== 'USD') {
    return refused('REFUSED_INVALID_CURRENCY', [F('INPUT_REFUSED')], 'only USD plans are supported; the snapshots are US consumer terms');
  }
  if (!Array.isArray(pp.plans) || pp.plans.length < PLANS_MIN) {
    return refused('REFUSED_NO_PLANS', [F('INPUT_REFUSED')], `plans must be an array of ${PLANS_MIN} to ${PLANS_MAX} plan objects`);
  }
  if (pp.plans.length > PLANS_MAX) {
    return refused('REFUSED_TOO_MANY_PLANS', [F('INPUT_REFUSED')], `at most ${PLANS_MAX} plans per comparison`);
  }

  const resolved = [];
  for (let i = 0; i < pp.plans.length; i++) {
    const r = resolvePlan(pp.plans[i], principal, i);
    if (r.err) return refused(r.err, r.flags, r.detail);
    resolved.push(r);
  }

  const results = [];
  const compliance_flags = [];
  for (let i = 0; i < resolved.length; i++) {
    const pl = resolved[i];
    const ppy = CADENCES[pl.cadence].periods_per_year;

    // Payment events: {due_periods, amount}. Period 0 is at purchase.
    const events = [];
    if (pl.down > 0) events.push({ due_periods: 0, amount: pl.down, kind: 'down_payment' });
    for (let k = 0; k < pl.n; k++) {
      const due = pl.firstAtPurchase ? k : k + 1;
      events.push({ due_periods: due, amount: r2(pl.baseInstalments[k] + pl.perInstFee), kind: 'instalment', no: k + 1 });
    }
    if (pl.upfrontFee > 0) events.push({ due_periods: 0, amount: pl.upfrontFee, kind: 'upfront_fee' });
    events.sort((a, b) => a.due_periods - b.due_periods || (a.no || 0) - (b.no || 0));

    // Delegate the APR to art-215, unchanged.
    const advances = [{ amount: r2(principal), full_periods: 0, fraction: 0 }];
    const payments = events.map((e) => ({ amount: e.amount, full_periods: e.due_periods, fraction: 0 }));
    const apr = computeRegZApr({ advances, payments, periods_per_year: ppy });
    const aprOut = apr.output_payload;

    const totalOfPayments = r2(events.reduce((s, e) => s + e.amount, 0));
    const totalFees = r2(pl.upfrontFee + pl.perInstFee * pl.n);
    const financeCharge = r2(totalOfPayments - principal);

    const flags = [];
    for (const fl of (apr.compliance_flags || [])) flags.push(`ART215_${fl}`);
    if (financeCharge < 0) flags.push('TOTAL_PAYMENTS_BELOW_PRINCIPAL_VERIFY');
    if (pl.statedApr > 0 && aprOut.converged && aprOut.bracketed && Math.abs(aprOut.apr_pct - pl.statedApr) > 1) {
      flags.push('STATED_APR_DIFFERS_FROM_REG_Z_COMPUTATION');
    }

    results.push({
      plan_index: i,
      label: pl.label,
      num_instalments: pl.n,
      cadence: pl.cadence,
      periods_per_year: ppy,
      first_instalment_at_purchase: pl.firstAtPurchase,
      schedule: events.map((e) => ({
        kind: e.kind, instalment_no: e.no ?? null,
        due_periods_from_purchase: e.due_periods, amount: e.amount,
      })),
      total_of_payments: totalOfPayments,
      fee_component_total: totalFees,
      finance_charge: financeCharge,
      stated_apr_pct: pl.statedApr,
      reg_z_apr: {
        apr_pct: aprOut.bracketed && aprOut.converged ? aprOut.apr_pct : null,
        periodic_rate: aprOut.bracketed && aprOut.converged ? aprOut.periodic_rate : null,
        converged: aprOut.converged, bracketed: aprOut.bracketed, iterations: aprOut.iterations,
      },
      preset: pl.preset ? {
        id: pl.presetId, provider: pl.preset.provider, display: pl.preset.display,
        kind: pl.preset.kind,
        labelled_example_principal: pl.preset.kind === 'labelled_example' ? pl.preset.labelled_principal : null,
        clauses: pl.preset.clauses, lender_note: pl.preset.lender_note ?? null,
        late_fee_note: pl.preset.late_fee_note ?? null, qualifiers: pl.preset.qualifiers,
        example_status: 'labelled example from the provider\'s published US consumer page, not an offer',
      } : null,
      flags,
    });
    compliance_flags.push(...flags);
  }

  // Side-by-side: rank by total of payments, exact to the cent.
  const order = results.map((r) => ({ i: r.plan_index, t: Math.round(r.total_of_payments * 100) }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const lowest = order.filter((o) => o.t === order[0].t).map((o) => o.i);
  for (const r of results) if (lowest.includes(r.plan_index)) r.flags.push('LOWEST_TOTAL_OF_PAYMENTS');

  const output_payload = {
    input_echo: { principal: r2(principal), currency: 'USD', plans: pp.plans },
    refused: false,
    comparison: {
      ranked_by_total_of_payments: order.map((o) => o.i),
      lowest_total_of_payments_plans: lowest,
    },
    plans: results,
    apr_method: 'Every APR is computed by art-215 compute_reg_z_appendix_j_apr (Reg Z Appendix J general actuarial equation, bracketed bisection), imported and delegated to, never reimplemented.',
    terms_note: 'Presets are labelled examples from dated provider snapshots, never an offer. Terms vary by provider, merchant and credit decision; provider quotes carry their own qualifiers.',
    late_fee_note: 'Late fees are contingent on missed payments and are not part of any schedule here; preset entries cite each provider\'s stated late-fee clause as information only.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
