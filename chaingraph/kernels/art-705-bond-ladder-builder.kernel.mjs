import { executionHash } from './_hash.mjs';

// art-705-bond-ladder-builder — bond ladder builder: rung-by-rung and portfolio duration, DV01 and
// convexity, with every reinvestment assumption named in `assumptions[]` (plain sentences, never an
// implicit assumption). Per-rung maths are implemented IN THIS KERNEL (no kernel imports another
// kernel — that would couple kernel digests) using the same formulas as art-329 (Macaulay/modified
// duration), art-330 (DV01 by central-difference full reprice) and art-331 (closed-form convexity);
// parity is asserted by chaingraph/kernels/art-705-bond-ladder-builder.parity.test.mjs, which imports
// those three kernels' exported compute() and asserts each rung's metrics equal theirs to <=1e-12
// relative on every fixture. KERNEL-CITATION-CLASS-1: this file is behaviour only.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, where TextEncoder/atob/btoa/URL
// are ABSENT (GUEST-BUILTIN-GATE-1). This kernel needs no UTF-8 encoding, so no encoder is carried.

const TOOL_ID = 'art-705-bond-ladder-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_bond_ladder',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Deterministic series math, byte-identical to the helpers in art-329/330/331 so per-rung metrics
// match those kernels bit-for-bit at output precision (parity gate: <=1e-12 relative).
function myExp(x) {
  if (!Number.isFinite(x)) return 0;
  let sum = 1, term = 1;
  for (let n = 1; n <= 80; n++) {
    term *= x / n;
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}
function myLn(x) {
  if (x <= 0 || !Number.isFinite(x)) return -1e300;
  const y = (x - 1) / (x + 1);
  let sum = 0, ypow = y, y2 = y * y;
  for (let k = 0; k < 100; k++) {
    sum += ypow / (2 * k + 1);
    ypow *= y2;
    if (Math.abs(ypow) < 1e-17) break;
  }
  return 2 * sum;
}
function myPow(base, exp) {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  if (exp === 0) return 1;
  if (base === 1) return 1;
  const iExp = Math.round(exp);
  if (Math.abs(exp - iExp) < 1e-12) {
    const n = Math.abs(iExp);
    let r = 1;
    for (let i = 0; i < n; i++) r *= base;
    return iExp < 0 ? 1 / r : r;
  }
  return myExp(exp * myLn(base));
}

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

// Standard bullet-bond cash-flow schedule: periods_per_year * years_to_maturity coupon payments of
// (face * coupon_rate_pct/100 / periods_per_year), face returned with the final coupon.
function buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) {
  const n = Math.max(1, Math.round(yearsToMaturity * periodsPerYear));
  const couponPerPeriod = face * (couponRatePct / 100) / periodsPerYear;
  const cashFlows = [];
  for (let t = 1; t <= n; t++) {
    const amount = t === n ? couponPerPeriod + face : couponPerPeriod;
    cashFlows.push({ t, amount });
  }
  return cashFlows;
}

// Macaulay/modified duration at a periodic yield (art-329 formula).
function priceAndDuration(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, weightedT = 0;
  for (const { t, amount } of cashFlows) {
    const disc = myPow(1 + periodicYield, -t);
    const pv = amount * disc;
    price += pv;
    weightedT += t * pv;
  }
  const macaulayPeriods = price !== 0 ? weightedT / price : 0;
  const macaulayYears = macaulayPeriods / periodsPerYear;
  const modifiedYears = macaulayYears / (1 + periodicYield);
  return { price, macaulayYears, modifiedYears };
}

// DV01 via central-difference full reprice at y +/- 1bp (art-330 formula).
function dv01Of(cashFlows, basePeriodicYield, periodsPerYear) {
  const shockPeriodicYield = (1 / 10000) / periodsPerYear;
  let priceUp = 0, priceDown = 0;
  for (const { t, amount } of cashFlows) {
    priceUp += amount * myPow(1 + basePeriodicYield + shockPeriodicYield, -t);
    priceDown += amount * myPow(1 + basePeriodicYield - shockPeriodicYield, -t);
  }
  return (priceDown - priceUp) / 2;
}

// Closed-form convexity: sum(CF_t * t*(t+1) / (1+y)^(t+2)) / Price, annualized by
// periods_per_year^2 (art-331 formula).
function priceAndConvexity(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, secondMoment = 0;
  for (const { t, amount } of cashFlows) {
    const disc = myPow(1 + periodicYield, -t);
    price += amount * disc;
    secondMoment += amount * t * (t + 1) * myPow(1 + periodicYield, -(t + 2));
  }
  const convexityPeriods = price !== 0 ? secondMoment / price : 0;
  const convexityAnnual = convexityPeriods / (periodsPerYear * periodsPerYear);
  return convexityAnnual;
}

const REINVESTMENT_ENUMS = ['hold_to_maturity', 'roll_to_longest_rung'];

// R4 (MR-R4-NULL-REGRESSION-GATE-1): an explicit null must get exactly the absent
// form's answer. Strip nulls to undefined at entry so every downstream path —
// defaults, refusals, Number() coercion — sees the two forms identically.
function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      ladder: null,
      portfolio: null,
      assumptions: [],
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

/**
 * compute(pp) — pure decision kernel.
 * pp: { notional, rungs: [{ maturity_years, coupon_rate_pct, yield_pct, target_weight }],
 *       periods_per_year, reinvestment_assumption }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  const notional = safeNum(pp.notional, NaN);
  if (!Number.isFinite(notional) || notional <= 0) {
    return refusal('NOTIONAL_NOT_POSITIVE', 'notional must be a positive finite number; got ' + JSON.stringify(pp.notional ?? null) + '.');
  }
  const rungsIn = pp.rungs;
  if (!Array.isArray(rungsIn) || rungsIn.length === 0) {
    return refusal('LADDER_EMPTY', 'rungs must be a non-empty array of { maturity_years, coupon_rate_pct, yield_pct, target_weight } objects.');
  }
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const reinvestment = pp.reinvestment_assumption === undefined ? 'hold_to_maturity' : pp.reinvestment_assumption;
  if (!REINVESTMENT_ENUMS.includes(reinvestment)) {
    return refusal('REINVESTMENT_ASSUMPTION_INVALID', "reinvestment_assumption must be one of 'hold_to_maturity' or 'roll_to_longest_rung'; got " + JSON.stringify(reinvestment) + '.');
  }

  const rungs = [];
  for (let i = 0; i < rungsIn.length; i++) {
    const r = deNull(rungsIn[i] || {});
    const maturity = safeNum(r.maturity_years, NaN);
    const coupon = safeNum(r.coupon_rate_pct, NaN);
    const yld = safeNum(r.yield_pct, NaN);
    const weight = safeNum(r.target_weight, NaN);
    if (!Number.isFinite(maturity) || maturity <= 0) {
      return refusal('RUNG_MATURITY_NOT_POSITIVE', 'rungs[' + i + '].maturity_years must be a positive finite number; got ' + JSON.stringify(r.maturity_years ?? null) + '.');
    }
    if (!Number.isFinite(coupon) || coupon < 0) {
      return refusal('RUNG_COUPON_INVALID', 'rungs[' + i + '].coupon_rate_pct must be a finite number >= 0; got ' + JSON.stringify(r.coupon_rate_pct ?? null) + '.');
    }
    if (!Number.isFinite(yld)) {
      return refusal('RUNG_YIELD_INVALID', 'rungs[' + i + '].yield_pct must be a finite number; got ' + JSON.stringify(r.yield_pct ?? null) + '.');
    }
    if (!Number.isFinite(weight) || weight < 0) {
      return refusal('RUNG_WEIGHT_INVALID', 'rungs[' + i + '].target_weight must be a finite number >= 0; got ' + JSON.stringify(r.target_weight ?? null) + '.');
    }
    rungs.push({ maturity, coupon, yld, weight });
  }

  const weightSum = rungs.reduce((s, r) => s + r.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-9) {
    return refusal('WEIGHTS_SUM_NOT_ONE', 'rung target_weight values must sum to 1 within 1e-9; they sum to ' + weightSum + ' (difference ' + (weightSum - 1) + ' from 1).');
  }

  const compliance_flags = [];
  const ladder = [];
  let weightedDuration = 0, weightedModified = 0, weightedDv01 = 0, weightedConvexity = 0;
  let longestYieldPct = 0, longestMaturity = -1;
  for (const r of rungs) {
    if (r.maturity > longestMaturity) { longestMaturity = r.maturity; longestYieldPct = r.yld; }
  }

  for (let i = 0; i < rungs.length; i++) {
    const r = rungs[i];
    const rungNotional = notional * r.weight;
    const cashFlows = buildSchedule(rungNotional, r.coupon, r.maturity, periodsPerYear);
    const periodicYield = r.yld / 100 / periodsPerYear;
    const { price, macaulayYears, modifiedYears } = priceAndDuration(cashFlows, periodicYield, periodsPerYear);
    const dv01 = dv01Of(cashFlows, periodicYield, periodsPerYear);
    const convexityAnnual = priceAndConvexity(cashFlows, periodicYield, periodsPerYear);
    if (r.coupon === 0) compliance_flags.push('ZERO_COUPON_RUNG_' + (i + 1));
    if (price <= 0) compliance_flags.push('NON_POSITIVE_RUNG_PRICE_' + (i + 1));

    weightedDuration += r.weight * macaulayYears;
    weightedModified += r.weight * modifiedYears;
    weightedDv01 += r.weight * dv01;
    weightedConvexity += r.weight * convexityAnnual;

    ladder.push({
      rung: i + 1,
      maturity_years: r.maturity,
      weight: r.weight,
      notional: r2(rungNotional),
      price: r2(price),
      duration: r6(macaulayYears),
      modified_duration: r6(modifiedYears),
      dv01: r6(dv01),
      convexity: r6(convexityAnnual),
    });
  }

  // Every assumption, named in plain sentences — never an implicit one.
  const assumptions = [
    'Schedule assumption: each rung is priced as an even-period bullet bond with ' + periodsPerYear + ' coupon period(s) per year — a fixed coupon of coupon_rate_pct/100 of face paid every period and face repaid with the final coupon; no odd first coupon, no stub periods, and no day-count accrual nuances are modeled.',
    "Yield assumption: each rung's yield_pct is a flat yield to maturity applied to all of that rung's cash flows; there is no credit spread, no forward curve, and no term-structure interpolation across rungs.",
    'Instrument assumption: all rungs are non-callable bullet bonds held to maturity — no call or put features, no default, no early sale, and no live market data are used.',
  ];
  if (reinvestment === 'hold_to_maturity') {
    assumptions.push("Reinvestment assumption (hold_to_maturity): every coupon payment and every maturing rung's principal are held as cash earning 0% after receipt — nothing is reinvested and nothing is rolled into other rungs. The duration, DV01 and convexity reported per rung and for the portfolio are computed on each rung's contractual bond cash flows only and do not depend on this assumption.");
  } else {
    assumptions.push('Reinvestment assumption (roll_to_longest_rung): every coupon payment and every maturing rung\u2019s principal are assumed reinvested at the longest rung\u2019s yield (' + longestYieldPct + '% nominal, ' + longestMaturity + ' years) as its cash flows are received, keeping the ladder fully invested. The duration, DV01 and convexity reported per rung and for the portfolio are computed on each rung\u2019s contractual bond cash flows only and do not depend on this assumption.');
  }
  assumptions.push('Portfolio aggregation assumption: portfolio weighted_duration, weighted_modified_duration, weighted_dv01 and weighted_convexity are target_weight-weighted averages of the per-rung figures; no diversification or cross-rung offset effects are modeled.');

  const output_payload = {
    notional: r2(notional),
    periods_per_year: periodsPerYear,
    reinvestment_assumption: reinvestment,
    num_rungs: rungs.length,
    ladder,
    portfolio: {
      weighted_duration: r6(weightedDuration),
      weighted_modified_duration: r6(weightedModified),
      weighted_dv01: r6(weightedDv01),
      weighted_convexity: r6(weightedConvexity),
    },
    assumptions,
    regulatory_basis: 'Standard fixed-income risk analytics (Macaulay/modified duration, DV01 by central-difference reprice, closed-form convexity) applied rung-by-rung over a target-weight bond ladder (Fabozzi, Bond Markets)',
    note: 'Per-rung maths are the same formulas as compute_bond_duration (art-329), compute_dv01 (art-330) and compute_convexity (art-331) applied at each rung\u2019s notional = notional * target_weight; parity is asserted by the art-705 parity gate. Exclusions: no credit spread, no call features, flat yield per rung, no live data.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
