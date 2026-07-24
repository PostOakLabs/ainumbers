import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-463-recalc-suite';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_audit_recalc_suite',
  mandate_type: 'compliance_control', gpu: false,
};

// Independent-recalculation substantive audit procedure. Recomputes five
// caller-supplied schedule types from first principles -- straight-line /
// double-declining-balance / units-of-production depreciation, interest
// accrual, EPS (basic and diluted), straight-line intangible amortization,
// and prepaid-expense roll-forwards -- and diffs each recalculated figure
// against the client's stated figure. A category only runs when the caller
// supplies items for it (an absent category is simply not in output_payload,
// never silently assumed empty-but-passing). The threshold gate
// (tolerance_abs, tolerance_pct) is a caller-declared policy input with an
// explicit, echoed default of 0/0 (flag any nonzero variance) when the
// caller declares neither -- there is no silent, unrecorded tolerance.
//
// EPS diluted here is the simplified NI-less-preferred-dividends-over-
// weighted-average-diluted-shares form; it does not model if-converted or
// treasury-stock adjustments for specific convertible instruments -- that is
// a judgment-heavy extension out of this kernel's deterministic-recalc scope
// (see AUDIT-RECALC-BUILD-SPEC.md kill criteria). DDB book value is derived
// by iterating the declining-balance formula period-by-period from period 1,
// floored at salvage value, which is the standard construction and avoids
// any closed-form rounding drift. Pure ECMA-262 arithmetic only -- no Date,
// no Math.random. NaN-safe; a zero-denominator ratio resolves to null, never
// NaN/Infinity (finite gate).

function num(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : null; }
function s(v) { return String(v == null ? '' : v).trim(); }

const BASIS_DAYS = { actual_360: 360, actual_365: 365, '30_360': 360 };

function withinTolerance(variance, base, tolAbs, tolPct) {
  const absOk = tolAbs != null ? Math.abs(variance) <= tolAbs : null;
  const pctOk = (tolPct != null && base !== 0) ? Math.abs((variance / base) * 100) <= tolPct : null;
  // Flag if EITHER declared gate is breached. If neither gate is applicable
  // (both null, or pct gate inapplicable because base is 0), fall back to
  // the abs gate only; if that too is inapplicable, flag any nonzero variance.
  if (absOk !== null || pctOk !== null) {
    const passes = [absOk, pctOk].filter((x) => x !== null);
    return passes.every((p) => p === true);
  }
  return variance === 0;
}

function ddbBookValue(cost, salvage, usefulLifeYears, periodNumber) {
  const rate = usefulLifeYears > 0 ? 2 / usefulLifeYears : 0;
  let bookValue = cost;
  let periodExpense = 0;
  for (let p = 1; p <= periodNumber; p++) {
    const candidate = bookValue * rate;
    const maxAllowed = Math.max(0, bookValue - salvage);
    periodExpense = Math.min(candidate, maxAllowed);
    bookValue = bookValue - periodExpense;
  }
  return { periodExpense, endingBookValue: bookValue };
}

function recalcDepreciation(items, tolAbs, tolPct) {
  return items.map((it) => {
    const asset_id = s(it && it.asset_id);
    const method = s(it && it.method) || 'straight_line';
    const cost = num(it && it.cost, 0);
    const salvage = num(it && it.salvage_value, 0);
    const usefulLife = num(it && it.useful_life_years, 0);
    const unitsTotal = num(it && it.units_total, 0);
    const unitsPeriod = num(it && it.units_period, 0);
    const periodNumber = Math.max(1, Math.trunc(num(it && it.period_number, 1)));
    const clientReported = num(it && it.client_reported_depreciation, 0);

    let recalculated = 0;
    if (method === 'ddb') {
      recalculated = r2(ddbBookValue(cost, salvage, usefulLife, periodNumber).periodExpense);
    } else if (method === 'units_of_production') {
      recalculated = r2(unitsTotal > 0 ? ((cost - salvage) / unitsTotal) * unitsPeriod : 0);
    } else {
      recalculated = r2(usefulLife > 0 ? (cost - salvage) / usefulLife : 0);
    }
    const variance = r2(recalculated - clientReported);
    const variance_pct = clientReported !== 0 ? r2((variance / clientReported) * 100) : null;
    const flagged = withinTolerance(variance, clientReported, tolAbs, tolPct) === false;
    return { asset_id, method, period_number: periodNumber, recalculated_depreciation: recalculated, client_reported_depreciation: r2(clientReported), variance, variance_pct, flagged };
  });
}

function recalcInterest(items, tolAbs, tolPct) {
  return items.map((it) => {
    const item_id = s(it && it.item_id);
    const principal = num(it && it.principal, 0);
    const annualRatePct = num(it && it.annual_rate_pct, 0);
    const daysAccrued = num(it && it.days_accrued, 0);
    const basis = s(it && it.day_count_basis) || 'actual_365';
    const basisDays = BASIS_DAYS[basis] || 365;
    const clientReported = num(it && it.client_reported_interest, 0);

    const recalculated = r2(principal * (annualRatePct / 100) * (daysAccrued / basisDays));
    const variance = r2(recalculated - clientReported);
    const variance_pct = clientReported !== 0 ? r2((variance / clientReported) * 100) : null;
    const flagged = withinTolerance(variance, clientReported, tolAbs, tolPct) === false;
    return { item_id, day_count_basis: basis, recalculated_interest: recalculated, client_reported_interest: r2(clientReported), variance, variance_pct, flagged };
  });
}

function recalcEps(items, tolAbs, tolPct) {
  return items.map((it) => {
    const label = s(it && it.label);
    const netIncome = num(it && it.net_income, 0);
    const preferredDividends = num(it && it.preferred_dividends, 0);
    const sharesBasic = num(it && it.weighted_avg_shares_basic, 0);
    const sharesDiluted = num(it && it.weighted_avg_shares_diluted, 0);
    const clientBasic = num(it && it.client_reported_eps_basic, 0);
    const clientDiluted = num(it && it.client_reported_eps_diluted, 0);

    const numerator = netIncome - preferredDividends;
    const epsBasic = sharesBasic > 0 ? r2(numerator / sharesBasic) : null;
    const epsDiluted = sharesDiluted > 0 ? r2(numerator / sharesDiluted) : null;
    const varianceBasic = epsBasic !== null ? r2(epsBasic - clientBasic) : null;
    const varianceDiluted = epsDiluted !== null ? r2(epsDiluted - clientDiluted) : null;
    const flaggedBasic = varianceBasic !== null && withinTolerance(varianceBasic, clientBasic, tolAbs, tolPct) === false;
    const flaggedDiluted = varianceDiluted !== null && withinTolerance(varianceDiluted, clientDiluted, tolAbs, tolPct) === false;

    return {
      label,
      recalculated_eps_basic: epsBasic, client_reported_eps_basic: r2(clientBasic), variance_basic: varianceBasic,
      recalculated_eps_diluted: epsDiluted, client_reported_eps_diluted: r2(clientDiluted), variance_diluted: varianceDiluted,
      flagged: flaggedBasic || flaggedDiluted,
    };
  });
}

function recalcAmortization(items, tolAbs, tolPct) {
  return items.map((it) => {
    const item_id = s(it && it.item_id);
    const principal = num(it && it.principal, 0);
    const periodsTotal = Math.max(0, Math.trunc(num(it && it.periods_total, 0)));
    const clientReported = num(it && it.client_reported_amortization, 0);

    const recalculated = r2(periodsTotal > 0 ? principal / periodsTotal : 0);
    const variance = r2(recalculated - clientReported);
    const variance_pct = clientReported !== 0 ? r2((variance / clientReported) * 100) : null;
    const flagged = withinTolerance(variance, clientReported, tolAbs, tolPct) === false;
    return { item_id, periods_total: periodsTotal, recalculated_amortization: recalculated, client_reported_amortization: r2(clientReported), variance, variance_pct, flagged };
  });
}

function recalcPrepaidRollforward(items, tolAbs, tolPct) {
  return items.map((it) => {
    const item_id = s(it && it.item_id);
    const beginningBalance = num(it && it.beginning_balance, 0);
    const additions = num(it && it.additions, 0);
    const amortizedCurrentPeriod = num(it && it.amortized_current_period, 0);
    const clientReported = num(it && it.client_reported_ending_balance, 0);

    const recalculated = r2(beginningBalance + additions - amortizedCurrentPeriod);
    const variance = r2(recalculated - clientReported);
    const variance_pct = clientReported !== 0 ? r2((variance / clientReported) * 100) : null;
    const flagged = withinTolerance(variance, clientReported, tolAbs, tolPct) === false;
    return { item_id, recalculated_ending_balance: recalculated, client_reported_ending_balance: r2(clientReported), variance, variance_pct, flagged };
  });
}

export function compute(pp) {
  pp = pp || {};
  const tolerance = pp.tolerance && typeof pp.tolerance === 'object' ? pp.tolerance : {};
  const tolAbs = tolerance.abs != null ? num(tolerance.abs, 0) : (tolerance.tolerance_abs != null ? num(tolerance.tolerance_abs, 0) : 0);
  const tolPct = tolerance.pct != null ? num(tolerance.pct, 0) : (tolerance.tolerance_pct != null ? num(tolerance.tolerance_pct, 0) : 0);
  const tolerance_declared = tolerance.abs != null || tolerance.pct != null || tolerance.tolerance_abs != null || tolerance.tolerance_pct != null;

  const categories_run = [];
  const output_payload = {
    tolerance_used: { abs: tolAbs, pct: tolPct, declared_by_caller: tolerance_declared },
    categories_run,
  };

  const dep = arr(pp.depreciation);
  if (dep) { output_payload.depreciation = recalcDepreciation(dep, tolAbs, tolPct); categories_run.push('depreciation'); }
  const interest = arr(pp.interest_accrual);
  if (interest) { output_payload.interest_accrual = recalcInterest(interest, tolAbs, tolPct); categories_run.push('interest_accrual'); }
  const eps = arr(pp.eps);
  if (eps) { output_payload.eps = recalcEps(eps, tolAbs, tolPct); categories_run.push('eps'); }
  const amort = arr(pp.amortization);
  if (amort) { output_payload.amortization = recalcAmortization(amort, tolAbs, tolPct); categories_run.push('amortization'); }
  const prepaid = arr(pp.prepaid_rollforward);
  if (prepaid) { output_payload.prepaid_rollforward = recalcPrepaidRollforward(prepaid, tolAbs, tolPct); categories_run.push('prepaid_rollforward'); }

  const allItems = categories_run.flatMap((c) => output_payload[c]);
  const flagged_count = allItems.filter((i) => i.flagged).length;
  output_payload.total_items = allItems.length;
  output_payload.flagged_count = flagged_count;

  const compliance_flags = ['RECALC_SUITE_RUN'];
  if (categories_run.length === 0) compliance_flags.push('RECALC_SUITE_NO_CATEGORIES');
  if (!tolerance_declared) compliance_flags.push('RECALC_SUITE_TOLERANCE_NOT_DECLARED');
  if (flagged_count > 0) compliance_flags.push('RECALC_SUITE_VARIANCE_FLAGGED');

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
