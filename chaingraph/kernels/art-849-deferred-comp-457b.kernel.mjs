import { executionHash } from './_hash.mjs';

// art-849-deferred-comp-457b: after-tax value of a 457(b) deferral against a taxable account.
// compute() is a pure function of pp: no clock, no network, no storage, no transcendentals
// (the growth factors use an exact integer-exponent loop, never Math.pow).

const TOOL_ID = 'art-849-deferred-comp-457b';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_deferred_comp_457b',
  mandate_type: 'compliance_control', gpu: false,
};

// Declared 2026 figures, echoed in every output as limits_used.
export const LIMITS_2026 = {
  elective_deferral_usd: 24500,
  age_50_catch_up_usd: 8000,
  age_60_to_63_catch_up_usd: 11250,
  special_catch_up_multiple: 2,
};
// Ceiling the page accepts for the deferral box (twice the elective limit).
export const MAX_DEFERRAL_USD = 49000;

// Domain bounds, taken from the Apex page's own input min/max attributes.
const BOUNDS = {
  annual_income_usd: { lo: 0, hi: 1e9, int: false },
  deferral_usd: { lo: 0, hi: MAX_DEFERRAL_USD, int: false },
  current_rate_pct: { lo: 0, hi: 60, int: false },
  retirement_rate_pct: { lo: 0, hi: 60, int: false },
  years_to_retirement: { lo: 1, hi: 50, int: true },
  growth_rate_pct: { lo: 0, hi: 20, int: false },
  withdrawal_years: { lo: 5, hi: 40, int: true },
  taxable_return_pct: { lo: 0, hi: 20, int: false },
  capital_gains_rate_pct: { lo: 0, hi: 40, int: false },
};
const FIELDS = Object.keys(BOUNDS);

function r(v, dp) {
  const f = 10 ** dp;
  return Number.isFinite(v) ? Math.round(v * f) / f : 0;
}
const r2 = (v) => r(v, 2);

// base ** n for a whole n >= 0 by repeated multiplication.
function ipow(base, n) {
  let out = 1;
  for (let i = 0; i < n; i++) out *= base;
  return out;
}

// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing.
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const x = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (x !== null) return x;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const x = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (x !== null) return x;
    }
    return null;
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function validate(pp) {
  const errors = [];
  for (const k of FIELDS) {
    const v = pp[k];
    const b = BOUNDS[k];
    // Absent and an explicit null refuse identically (the R4 relation); neither is defaulted.
    if (v === undefined || v === null) { errors.push('REFUSED_INPUT_MISSING: ' + k); continue; }
    if (typeof v !== 'number') { errors.push('REFUSED_INPUT_WRONG_TYPE: ' + k); continue; }
    if (!Number.isFinite(v)) { errors.push('REFUSED_INPUT_UNSAFE_NUMBER: ' + k); continue; }
    if (b.int && !Number.isSafeInteger(v)) { errors.push('REFUSED_INPUT_NOT_INTEGER: ' + k); continue; }
    if (v < b.lo || v > b.hi) errors.push('REFUSED_INPUT_OUT_OF_RANGE: ' + k);
  }
  return errors;
}

// Smallest deferral tier that would permit the amount. Eligibility itself (age, plan
// terms) is never tested here.
function limitTier(d) {
  const L = LIMITS_2026;
  if (d <= L.elective_deferral_usd) return 'STANDARD';
  if (d <= L.elective_deferral_usd + L.age_50_catch_up_usd) return 'AGE_50_CATCH_UP';
  if (d <= L.elective_deferral_usd + L.age_60_to_63_catch_up_usd) return 'AGE_60_TO_63_CATCH_UP';
  return 'SPECIAL_CATCH_UP_RANGE';
}

const NOTE = 'Scenario A defers the amount pre-tax and grows it at growth_rate_pct, taxed at retirement_rate_pct on withdrawal. Scenario B invests deferral x (1 - current rate) in a taxable account at taxable_return_pct, with capital_gains_rate_pct on the gain at liquidation. Withdrawals are level over withdrawal_years and discounted at growth_rate_pct for the NPV figures. break_even_retirement_rate_pct = 100 x (1 - taxable net / deferral balance), clamped to 0..100. Arithmetic over declared figures; not tax advice, and the plan document governs.';

export function compute(rawPp) {
  const shapeErrors = [];
  if (!isPlainObject(rawPp)) {
    shapeErrors.push('REFUSED_INPUT_WRONG_TYPE: policy parameters must be a plain object');
  } else {
    const unhashable = findHashRefusal(rawPp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
    if (unhashable !== null) shapeErrors.push(unhashable.reason + ': ' + unhashable.detail);
  }
  const pp = shapeErrors.length === 0 ? Object.fromEntries(Object.entries(rawPp)) : {};
  const errors = shapeErrors.length === 0 ? validate(pp) : shapeErrors;
  const valid_input = errors.length === 0;

  const compliance_flags = [];
  const echo = {};
  for (const k of FIELDS) echo[k] = (typeof pp[k] === 'number' && Number.isFinite(pp[k])) ? pp[k] : null;
  // Income is echoed only; no figure depends on it. Read by name so the declaration is visibly consumed.
  echo.annual_income_usd = (typeof pp.annual_income_usd === 'number' && Number.isFinite(pp.annual_income_usd)) ? pp.annual_income_usd : null;

  if (!valid_input) {
    compliance_flags.push('INPUT_REFUSED');
    return {
      output_payload: {
        valid_input, domain_errors: errors, inputs: echo, limits_used: { ...LIMITS_2026, max_deferral_usd: MAX_DEFERRAL_USD },
        limit_tier: null, scenario_a: null, scenario_b: null, advantage: null,
        warnings: compliance_flags.slice(), note: NOTE,
      },
      compliance_flags,
    };
  }

  const deferral = pp.deferral_usd;
  const curRate = pp.current_rate_pct / 100;
  const retRate = pp.retirement_rate_pct / 100;
  const years = pp.years_to_retirement;
  const growth = pp.growth_rate_pct / 100;
  const wy = pp.withdrawal_years;
  const taxableReturn = pp.taxable_return_pct / 100;
  const cgRate = pp.capital_gains_rate_pct / 100;

  // Scenario A: pre-tax deferral, tax-deferred growth, taxed on withdrawal.
  const taxSavedNow = deferral * curRate;
  const aBalance = deferral * ipow(1 + growth, years);
  const aAnnualWithdraw = aBalance / wy;
  const aAfterTaxAnnual = aAnnualWithdraw * (1 - retRate);
  const aTotalAfterTax = aAfterTaxAnnual * wy;
  let aNpv = 0;
  let disc = ipow(1 + growth, years);
  for (let y = 1; y <= wy; y++) {
    disc *= 1 + growth;
    aNpv += aAfterTaxAnnual / disc;
  }

  // Scenario B: take the pay, invest after-tax cash in a taxable account.
  const bInvestable = deferral * (1 - curRate);
  const bGross = bInvestable * ipow(1 + taxableReturn, years);
  const bGains = bGross - bInvestable;
  const bNet = bGross - bGains * cgRate;
  const bAnnualWithdraw = bNet / wy;
  let bNpv = 0;
  disc = ipow(1 + growth, years);
  for (let y = 1; y <= wy; y++) {
    disc *= 1 + growth;
    bNpv += bAnnualWithdraw / disc;
  }

  const totalAdvantage = aTotalAfterTax - bNet;
  const npvAdvantage = aNpv - bNpv;

  let breakEven = 0;
  if (aBalance !== 0) breakEven = 1 - bNet / aBalance;
  let be = breakEven;
  if (be < 0) { be = 0; compliance_flags.push('BREAK_EVEN_CLAMPED_TO_ZERO'); }
  if (be > 1) { be = 1; compliance_flags.push('BREAK_EVEN_CLAMPED_TO_ONE'); }

  if (deferral > LIMITS_2026.elective_deferral_usd) compliance_flags.push('DEFERRAL_ABOVE_STANDARD_LIMIT');

  const output_payload = {
    valid_input,
    domain_errors: [],
    inputs: echo,
    limits_used: { ...LIMITS_2026, max_deferral_usd: MAX_DEFERRAL_USD },
    limit_tier: limitTier(deferral),
    scenario_a: {
      tax_saved_now_usd: r2(taxSavedNow),
      balance_at_retirement_usd: r2(aBalance),
      annual_after_tax_withdrawal_usd: r2(aAfterTaxAnnual),
      total_after_tax_usd: r2(aTotalAfterTax),
      npv_usd: r2(aNpv),
    },
    scenario_b: {
      investable_usd: r2(bInvestable),
      gross_balance_usd: r2(bGross),
      balance_after_gains_tax_usd: r2(bNet),
      annual_withdrawal_usd: r2(bAnnualWithdraw),
      total_after_tax_usd: r2(bNet),
      npv_usd: r2(bNpv),
    },
    advantage: {
      total_usd: r2(totalAdvantage),
      npv_usd: r2(npvAdvantage),
      break_even_retirement_rate_pct: r(be * 100, 4),
      verdict: totalAdvantage >= 0 ? 'FAVORS_457B' : 'FAVORS_TAXABLE',
    },
    warnings: compliance_flags.slice(),
    note: NOTE,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
    execution_hash: unhashable === null ? await executionHash(pp, output_payload) : null,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
