import { executionHash } from './_hash.mjs';

// art-850-shariah-equity-purification — Shariah equity screen with dividend purification.
// One company's caller-supplied financial values are screened under each requested authority
// profile, never merged: every ratio keeps its own threshold, denominator and comparison as
// pinned by that profile alone. Arithmetic only: the node outputs verdict rows and purification
// amounts and never a ruling, certification or opinion (not_a_shariah_ruling on every payload).
//
// Money is integer minor units end to end. Every threshold comparison is exact: numerator and
// denominator are cross-multiplied in BigInt against the basis-point threshold, so a verdict
// flips exactly at the printed threshold and never on float rounding. Payload numbers are all
// safe integers; BigInt never escapes compute().
//
// Averages are reported floored to the minor unit (named rounding, never hidden) while the
// verdict uses the exact unfloored mean via cross-multiplication, so the reported figure and
// the verdict can never disagree.

const TOOL_ID = 'art-850-shariah-equity-purification';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'screen_shariah_equity_purification',
  mandate_type: 'compliance_control', gpu: false,
};

// ── authority profiles (values-only tables; each profile stands alone, never merged) ──
export const AUTHORITIES = ['msci_islamic', 'msci_islamic_m', 'ftse_idealratings', 'nifty_tasis'];

// methodology_as_of per profile, from the pinned edition each profile implements.
export const METHODOLOGY_AS_OF = {
  msci_islamic: '2024-10',
  msci_islamic_m: '2024-10',
  ftse_idealratings: '2026-03',
  nifty_tasis: '2022-02',
};

// Retention (current constituent) thresholds in basis points, per profile, keyed by ratio.
// Long-form profile: all three ratios against total assets.
// Average-cap profile: the same three ratios against the 36-month average month-end market
// capitalization, with the receivables-and-cash ratio widened to 4900 bp.
const RETENTION_BP = {
  msci_islamic: { total_debt: 3333, cash_and_interest_bearing_securities: 3333, receivables_and_cash: 3333 },
  msci_islamic_m: { total_debt: 3333, cash_and_interest_bearing_securities: 3333, receivables_and_cash: 4900 },
};

// Entry (new inclusion) thresholds in basis points — the lower set used to test a security
// that is not a current constituent.
const ENTRY_BP = {
  msci_islamic: { total_debt: 3000, cash_and_interest_bearing_securities: 3000, receivables_and_cash: 3000 },
  msci_islamic_m: { total_debt: 3000, cash_and_interest_bearing_securities: 3000, receivables_and_cash: 4600 },
};

// Screening-profile thresholds (no constituent distinction): business activity and
// non-permissible income at 500 bp; conventional debt and cash each at 3300 bp of the
// 24-month average daily market cap, falling back to total assets when the average cap is
// below the asset value.
const FTSE_BP = {
  business_activity: 500,
  total_debt: 3300,
  cash_and_interest_bearing_securities: 3300,
  non_permissible_income: 500,
};

// Debt at 2500 bp of total assets; interest income plus 7.5% imputed returns on
// interest-based investments at 300 bp of total income; receivables plus cash and bank
// balances at 9000 bp of total assets.
const NIFTY_BP = {
  interest_based_debt: 2500,
  interest_income_plus_imputed: 300,
  receivables_and_cash_bank: 9000,
};
const NIFTY_IMPUTED_RETURN_BP = 750; // the imputed return rate on interest-based investments

// Shariah-compliant debt is excluded from the total-debt numerator for these country codes
// only; everywhere else the raw total debt figure is used.
const CARVEOUT_COUNTRY_CODES = ['BH', 'KW', 'OM', 'QA', 'AE', 'BD', 'EG', 'ID', 'MY', 'PK', 'TR'];

// ── declared input bounds (named, refused, never coerced) ──────────────────────────
export const MAX_AMOUNT_MINOR = 1000000000000000;        // 1e15 minor units per amount
export const MAX_SERIES_ELEMENT_MINOR = 10000000000000;  // 1e13 minor units per series element
export const MAX_SERIES_LEN = 600;
export const MAX_MSCI_WINDOW_MONTHS = 36;                // the average-cap profile window

const MSCI_WINDOW_DENOMINATOR = 'avg_market_cap_36m_month_end';
const SERIES_PERIODS = ['month_end', 'day'];

// Fields each authority profile requires (presence is checked per selected profile; a
// present field is always type-validated regardless of who required it).
const REQUIRED_BY_AUTHORITY = {
  msci_islamic: ['total_assets_minor', 'total_debt_minor', 'cash_and_interest_bearing_securities_minor', 'receivables_minor'],
  msci_islamic_m: ['total_debt_minor', 'cash_and_interest_bearing_securities_minor', 'receivables_minor', 'market_cap_series_minor', 'market_cap_series_period'],
  ftse_idealratings: ['total_assets_minor', 'total_debt_minor', 'cash_and_interest_bearing_securities_minor', 'total_revenue_minor', 'non_permissible_revenue_minor', 'interest_income_minor', 'total_income_minor', 'market_cap_series_minor', 'market_cap_series_period'],
  nifty_tasis: ['total_assets_minor', 'total_debt_minor', 'cash_and_interest_bearing_securities_minor', 'receivables_minor', 'interest_income_minor', 'total_income_minor', 'interest_based_investments_minor'],
};

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes the shared canonicalizer refuses before hashing: a non-finite number,
// an integer outside the safe range, nesting past its depth limit, more values than its
// element limit. Reports { reason, detail } with the path and kind only, never the value;
// null when the subtree is safe to hash.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
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
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

// ── exact threshold comparison (BigInt cross-multiplication, never floats) ───────
// compliant iff numerator / denominator <= threshold_bp / 10000, i.e. iff
// numerator * 10000 <= threshold_bp * denominator. Every pinned profile expresses its
// exclusion as exceeding the threshold, so equality is compliant on every row.
function compliantAtThreshold(numeratorMinor, denominatorMinor, thresholdBp) {
  const lhs = BigInt(numeratorMinor) * 10000n;
  const rhs = BigInt(thresholdBp) * BigInt(denominatorMinor);
  return lhs <= rhs;
}

// Same comparison against an unrounded mean denominator sum/len: cross-multiplied to
// numerator * 10000 * len <= threshold_bp * sum, so the verdict uses the exact mean and
// never the floored figure that is reported.
function compliantAtExactMean(numeratorMinor, sumMinor, len, thresholdBp) {
  return BigInt(numeratorMinor) * 10000n * BigInt(len) <= BigInt(thresholdBp) * sumMinor;
}

// Floor of numerator * multiplier / denominator, exact, payload-safe by construction
// (both inputs are validated safe integers and the result is bounded by numerator).
function mulDivFloor(numeratorMinor, multiplierMinor, denominatorMinor) {
  const v = (BigInt(numeratorMinor) * BigInt(multiplierMinor)) / BigInt(denominatorMinor);
  return Number(v);
}
function mulDivRemainder(numeratorMinor, multiplierMinor, denominatorMinor, flooredMinor) {
  const v = (BigInt(numeratorMinor) * BigInt(multiplierMinor)) - (BigInt(flooredMinor) * BigInt(denominatorMinor));
  return Number(v);
}

function isSafeInt(v) { return typeof v === 'number' && Number.isSafeInteger(v); }
function isAmount(v) { return isSafeInt(v) && v >= 0 && v <= MAX_AMOUNT_MINOR; }
function isSeriesElement(v) { return isSafeInt(v) && v >= 1 && v <= MAX_SERIES_ELEMENT_MINOR; }

// Exact floor of sum/len as a payload-safe number (elements are capped well below the
// safe-integer range even before the division).
function meanFloor(sumMinor, len) {
  return Number(BigInt(sumMinor) / BigInt(len));
}
// True iff sum < total_assets * len, i.e. the exact mean is below the asset value.
function meanBelow(sumMinor, len, totalAssetsMinor) {
  return BigInt(sumMinor) < BigInt(totalAssetsMinor) * BigInt(len);
}

// Flags are computed from inputs; each named flag appears at most once, in first-push order.
function pushFlag(flags, flag) {
  if (flags.indexOf(flag) === -1) flags.push(flag);
}

// Append one ratio row to a verdict. When row.compliant is preset the caller has already
// decided it with exact cross-multiplied BigInt math (scaled forms that cannot round-trip
// through payload-safe integers); otherwise it is decided here from the reported figures.
// Rounding annotations mark figures reported floored to the minor unit while the verdict
// used the exact unfloored value.
function pushRatio(verdict, row) {
  const ok = row.compliant !== undefined ? row.compliant : compliantAtThreshold(row.numerator_minor, row.denominator_minor, row.threshold_bp);
  verdict.ratios.push({
    ratio: row.ratio,
    numerator_minor: row.numerator_minor,
    denominator_minor: row.denominator_minor,
    denominator_used: row.denominator_used,
    threshold_bp: row.threshold_bp,
    comparison: 'lte',
    compliant: ok,
    ...(row.numerator_rounding ? { numerator_rounding: row.numerator_rounding } : {}),
    ...(row.denominator_rounding ? { denominator_rounding: row.denominator_rounding } : {}),
  });
  if (!ok) verdict.compliant = false;
}

/**
 * compute(pp) — pure decision kernel.
 * @param {object} rawPp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(rawPp) {
  const compliance_flags = [];
  const domain_errors = [];

  if (rawPp === null || typeof rawPp !== 'object' || Array.isArray(rawPp)) {
    return refusalPayload(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be a plain object, got ' + (rawPp === null ? 'null' : typeof rawPp)], ['EQUITY_SCREEN_INPUT_OUT_OF_DECLARED_DOMAIN']);
  }
  // Own-property copy on a null prototype: fixed keys are read through this view so an
  // inherited or poisoned member can never be read, and prototype-named keys are inert.
  // R4 (absent equals explicit null): null carries no third state on any input property,
  // so a null-valued key is dropped from the view and the null form answers exactly the
  // absent form, byte for byte.
  const pp = Object.create(null);
  for (const k of Object.keys(rawPp)) if (rawPp[k] !== null) pp[k] = rawPp[k];

  // ── authorities requested ─────────────────────────────────────────────────────
  const methodologiesRaw = pp.methodologies;
  let methodologies = null;
  let authorityUnpinned = false;
  if (!Array.isArray(methodologiesRaw) || methodologiesRaw.length < 1 || methodologiesRaw.length > AUTHORITIES.length) {
    domain_errors.push('methodologies must be a non-empty array of at most ' + AUTHORITIES.length + ' authority keys, got ' + (methodologiesRaw === undefined ? 'absent' : Array.isArray(methodologiesRaw) ? 'array of length ' + methodologiesRaw.length : typeof methodologiesRaw));
  } else {
    methodologies = [];
    const seen = Object.create(null);
    for (const m of methodologiesRaw) {
      if (typeof m !== 'string' || !AUTHORITIES.includes(m)) {
        domain_errors.push('methodologies entry ' + (typeof m === 'string' ? JSON.stringify(m) : String(m)) + ' is not a pinned authority for this node; supported authorities: ' + AUTHORITIES.join(', '));
        authorityUnpinned = true;
        continue;
      }
      if (seen[m]) { domain_errors.push('methodologies entry ' + JSON.stringify(m) + ' appears more than once'); continue; }
      seen[m] = true;
      methodologies.push(m);
    }
    if (methodologies.length === 0) methodologies = null;
  }
  if (authorityUnpinned) compliance_flags.push('AUTHORITY_NOT_PINNED');

  // ── per-field validation (a present field is always validated; required fields are
  //    collected from the union of the selected profiles) ──────────────────────────
  const selected = methodologies === null ? [] : methodologies;
  const required = new Set();
  for (const a of selected) {
    // selected is allowlist-filtered above; this guard is an invariant break alarm, not a
    // coercion path (caller-key lint: no caller-derived key into an unguarded object).
    if (!Object.hasOwn(REQUIRED_BY_AUTHORITY, a)) throw new Error('unpinned authority profile: ' + a);
    for (const f of REQUIRED_BY_AUTHORITY[a]) required.add(f);
  }
  const wantsMsci = selected.includes('msci_islamic') || selected.includes('msci_islamic_m');
  if (wantsMsci) { required.add('is_current_constituent'); required.add('country_code'); }

  // country/carve-out interplay determines whether the compliant-debt figure is required.
  let countryCode = null;
  if (pp.country_code !== undefined) {
    const ccOk = typeof pp.country_code === 'string' && pp.country_code.length === 2
      && pp.country_code.charCodeAt(0) >= 65 && pp.country_code.charCodeAt(0) <= 90
      && pp.country_code.charCodeAt(1) >= 65 && pp.country_code.charCodeAt(1) <= 90;
    if (!ccOk) domain_errors.push('country_code must be a two-letter uppercase ISO-3166-1 alpha-2 code, got ' + (typeof pp.country_code === 'string' ? JSON.stringify(pp.country_code) : typeof pp.country_code));
    else countryCode = pp.country_code;
  }
  const carveoutApplies = wantsMsci && countryCode !== null && CARVEOUT_COUNTRY_CODES.includes(countryCode);
  if (carveoutApplies) required.add('shariah_compliant_debt_minor');

  const dividendPresent = pp.dividend_minor !== undefined;
  if (dividendPresent) required.add('dividend_minor');
  if (dividendPresent && wantsMsci) {
    required.add('non_permissible_revenue_minor');
    required.add('interest_income_minor');
    required.add('total_income_minor');
  }

  // Money fields: declared bound, safe integer, non-negative; asset value and total income
  // must be positive (both are denominators).
  for (const f of ['total_assets_minor', 'total_debt_minor', 'shariah_compliant_debt_minor', 'cash_and_interest_bearing_securities_minor', 'receivables_minor', 'total_revenue_minor', 'non_permissible_revenue_minor', 'interest_income_minor', 'interest_based_investments_minor', 'total_income_minor', 'dividend_minor']) {
    const v = pp[f];
    if (v === undefined) {
      if (required.has(f)) domain_errors.push(f + ' is required for the requested authority profile(s) but absent');
      continue;
    }
    if (!isAmount(v)) {
      domain_errors.push(f + ' must be an integer in [0, ' + MAX_AMOUNT_MINOR + '] minor units, got ' + (v === null ? 'null' : typeof v === 'number' ? (Number.isSafeInteger(v) ? 'integer out of bounds' : 'non-finite or unsafe integer') : typeof v));
      continue;
    }
    if ((f === 'total_assets_minor' || f === 'total_income_minor') && v <= 0) {
      domain_errors.push(f + ' must be a positive integer (it is a ratio denominator), got ' + v);
    }
  }
  if (isAmount(pp.total_debt_minor) && pp.shariah_compliant_debt_minor !== undefined && isAmount(pp.shariah_compliant_debt_minor) && pp.shariah_compliant_debt_minor > pp.total_debt_minor) {
    domain_errors.push('shariah_compliant_debt_minor must not exceed total_debt_minor');
  }

  // Constituent flag selects the threshold set; only a real boolean is accepted.
  let isCurrentConstituent = null;
  if (pp.is_current_constituent !== undefined) {
    if (typeof pp.is_current_constituent !== 'boolean') {
      domain_errors.push('is_current_constituent must be a boolean, got ' + (pp.is_current_constituent === null ? 'null' : typeof pp.is_current_constituent));
    } else {
      isCurrentConstituent = pp.is_current_constituent;
    }
  } else if (required.has('is_current_constituent')) {
    domain_errors.push('is_current_constituent is required when a long-form or average-cap authority profile is requested but absent');
  }

  // Market-cap series: elements individually bounded; the denominator window is owned by
  // the caller for the daily-average profile (assumptions of use in the node metadata).
  let series = null;
  let seriesPeriod = null;
  if (pp.market_cap_series_minor !== undefined || pp.market_cap_series_period !== undefined) {
    const s = pp.market_cap_series_minor;
    if (!Array.isArray(s) || s.length < 1 || s.length > MAX_SERIES_LEN) {
      domain_errors.push('market_cap_series_minor must be an array of 1 to ' + MAX_SERIES_LEN + ' period market caps in minor units, got ' + (s === undefined ? 'absent' : Array.isArray(s) ? 'array of length ' + s.length : typeof s));
    } else {
      let ok = true;
      let sum = 0n;
      for (let i = 0; i < s.length; i++) {
        if (!isSeriesElement(s[i])) {
          domain_errors.push('market_cap_series_minor[' + i + '] must be an integer in [1, ' + MAX_SERIES_ELEMENT_MINOR + '] minor units, got ' + (s[i] === null ? 'null' : typeof s[i] === 'number' ? (Number.isSafeInteger(s[i]) ? 'integer out of bounds' : 'non-finite or unsafe integer') : typeof s[i]));
          ok = false;
          break;
        }
        sum += BigInt(s[i]);
      }
      if (ok) series = { elements: s, sum };
    }
    const p = pp.market_cap_series_period;
    if (typeof p !== 'string' || !SERIES_PERIODS.includes(p)) {
      domain_errors.push('market_cap_series_period must be exactly one of ' + SERIES_PERIODS.map((x) => JSON.stringify(x)).join(', ') + ', got ' + (p === undefined ? 'absent' : typeof p === 'string' ? JSON.stringify(p) : typeof p));
    } else {
      seriesPeriod = p;
    }
  }
  for (const a of selected) {
    if (!Object.hasOwn(REQUIRED_BY_AUTHORITY, a)) throw new Error('unpinned authority profile: ' + a);
    if (REQUIRED_BY_AUTHORITY[a].includes('market_cap_series_minor') && pp.market_cap_series_minor === undefined) {
      domain_errors.push('market_cap_series_minor is required for authority profile ' + a + ' but absent');
    }
    if (REQUIRED_BY_AUTHORITY[a].includes('market_cap_series_period') && pp.market_cap_series_period === undefined) {
      domain_errors.push('market_cap_series_period is required for authority profile ' + a + ' but absent');
    }
    // The average-cap profile is defined on month-end observations only; a valid-but-daily
    // series is the wrong denominator basis for it and refuses rather than mis-averaging.
    if (a === 'msci_islamic_m' && pp.market_cap_series_period !== undefined && pp.market_cap_series_period !== 'month_end') {
      domain_errors.push('authority profile msci_islamic_m requires market_cap_series_period exactly "month_end", got ' + JSON.stringify(pp.market_cap_series_period));
    }
  }

  const inputValid = domain_errors.length === 0;
  if (!inputValid) pushFlag(compliance_flags, 'EQUITY_SCREEN_INPUT_OUT_OF_DECLARED_DOMAIN');
  if (!inputValid || methodologies === null) {
    return refusalPayload(domain_errors, compliance_flags);
  }

  // ── shared denominators ────────────────────────────────────────────────────────
  const totalAssets = pp.total_assets_minor;
  const totalDebt = pp.total_debt_minor;
  const cashIb = pp.cash_and_interest_bearing_securities_minor;
  const receivables = pp.receivables_minor;

  // Compliant-debt carve-out: subtract only for the declared country set, only when the
  // caller supplied a figure and it actually removes something.
  let debtNumeratorMsci = totalDebt;
  if (carveoutApplies && isAmount(pp.shariah_compliant_debt_minor) && pp.shariah_compliant_debt_minor > 0) {
    debtNumeratorMsci = totalDebt - pp.shariah_compliant_debt_minor;
    compliance_flags.push('MSCI_CARVEOUT_APPLIED');
  }

  // Average-cap window: the mean of the last N month-end observations; fewer available
  // months are averaged as-is (the window shortens, the mean stays exact). Computed only
  // when an average-cap profile is selected.
  let msciAvgSum = null;
  let msciAvgLen = 0;
  if (wantsMsci && series !== null && seriesPeriod === 'month_end') {
    msciAvgLen = Math.min(MAX_MSCI_WINDOW_MONTHS, series.elements.length);
    let s = 0n;
    for (let i = series.elements.length - msciAvgLen; i < series.elements.length; i++) s += BigInt(series.elements[i]);
    msciAvgSum = s;
  }

  // Daily-average window: the mean over the whole supplied window; when that mean falls
  // below the asset value the asset value replaces it as the denominator. Computed only
  // when the daily-average profile is selected.
  let ftseDenominator = null;
  let ftseDenominatorUsed = null;
  if (selected.includes('ftse_idealratings') && series !== null) {
    if (seriesPeriod === 'month_end') pushFlag(compliance_flags, 'FTSE_ADMC_FROM_MONTHLY_AVERAGES');
    const n = series.elements.length;
    if (meanBelow(series.sum, n, totalAssets)) {
      ftseDenominator = BigInt(totalAssets);
      ftseDenominatorUsed = 'total_assets';
      compliance_flags.push('FTSE_DENOMINATOR_SWITCHED_TO_TOTAL_ASSETS');
    } else {
      ftseDenominator = series.sum / BigInt(n);
      ftseDenominatorUsed = 'admc_24m';
    }
  }

  // ── per-authority verdict rows (never merged across profiles) ──────────────────
  const verdicts = Object.create(null);
  for (const a of selected) {
    if (!Object.hasOwn(METHODOLOGY_AS_OF, a)) throw new Error('unpinned authority profile: ' + a);
    const verdict = {
      methodology_as_of: METHODOLOGY_AS_OF[a],
      profile: 'standard',
      is_current_constituent: null,
      ratios: [],
      compliant: true,
      purification: null,
    };
    if (a === 'msci_islamic' || a === 'msci_islamic_m') {
      const entry = !isCurrentConstituent;
      if (!Object.hasOwn(ENTRY_BP, a) || !Object.hasOwn(RETENTION_BP, a)) throw new Error('unpinned authority profile: ' + a);
      const bp = entry ? ENTRY_BP[a] : RETENTION_BP[a];
      verdict.profile = entry ? 'entry' : 'retention';
      verdict.is_current_constituent = isCurrentConstituent;
      if (entry) pushFlag(compliance_flags, 'MSCI_ENTRY_THRESHOLDS_APPLIED');
      const isLongForm = a === 'msci_islamic';
      const denom = isLongForm ? totalAssets : Number(msciAvgSum / BigInt(msciAvgLen));
      const denomUsed = isLongForm ? 'total_assets' : MSCI_WINDOW_DENOMINATOR;
      const denomRounding = isLongForm ? undefined : 'floor_minor_unit';
      for (const ratioName of ['total_debt', 'cash_and_interest_bearing_securities', 'receivables_and_cash']) {
        let numerator;
        if (ratioName === 'total_debt') numerator = debtNumeratorMsci;
        else if (ratioName === 'cash_and_interest_bearing_securities') numerator = cashIb;
        else numerator = receivables + cashIb;
        pushRatio(verdict, {
          ratio: ratioName,
          numerator_minor: numerator,
          denominator_minor: denom,
          denominator_used: denomUsed,
          threshold_bp: bp[ratioName],
          compliant: isLongForm ? undefined : compliantAtExactMean(numerator, msciAvgSum, msciAvgLen, bp[ratioName]),
          denominator_rounding: denomRounding,
        });
      }
    } else if (a === 'ftse_idealratings') {
      const denomDebtCash = Number(ftseDenominator);
      const denomRounding = ftseDenominatorUsed === 'admc_24m' ? 'floor_minor_unit' : undefined;
      const seriesLen = series.elements.length;
      pushRatio(verdict, { ratio: 'business_activity', numerator_minor: pp.non_permissible_revenue_minor, denominator_minor: pp.total_revenue_minor, denominator_used: 'total_revenue', threshold_bp: FTSE_BP.business_activity });
      pushRatio(verdict, {
        ratio: 'total_debt',
        numerator_minor: totalDebt,
        denominator_minor: denomDebtCash,
        denominator_used: ftseDenominatorUsed,
        threshold_bp: FTSE_BP.total_debt,
        compliant: denomRounding ? compliantAtExactMean(totalDebt, series.sum, seriesLen, FTSE_BP.total_debt) : undefined,
        denominator_rounding: denomRounding,
      });
      pushRatio(verdict, {
        ratio: 'cash_and_interest_bearing_securities',
        numerator_minor: cashIb,
        denominator_minor: denomDebtCash,
        denominator_used: ftseDenominatorUsed,
        threshold_bp: FTSE_BP.cash_and_interest_bearing_securities,
        compliant: denomRounding ? compliantAtExactMean(cashIb, series.sum, seriesLen, FTSE_BP.cash_and_interest_bearing_securities) : undefined,
        denominator_rounding: denomRounding,
      });
      pushRatio(verdict, { ratio: 'non_permissible_income', numerator_minor: pp.interest_income_minor + pp.non_permissible_revenue_minor, denominator_minor: pp.total_income_minor, denominator_used: 'total_income', threshold_bp: FTSE_BP.non_permissible_income });
      if (dividendPresent) {
        pushFlag(compliance_flags, 'PURIFICATION_NOT_PINNED_FTSE');
        verdict.purification = null;
      }
    } else if (a === 'nifty_tasis') {
      // Interest income plus the imputed return on interest-based investments at the pinned
      // coefficient: the scaled comparison form exceeds the payload-safe integer range, so
      // the verdict is cross-multiplied in BigInt while the reported numerator is that same
      // scaled sum floored back to minor units (floored report, exact verdict).
      const exactLhs = BigInt(pp.interest_income_minor) * 10000n + BigInt(NIFTY_IMPUTED_RETURN_BP) * BigInt(pp.interest_based_investments_minor);
      const exactRhs = BigInt(NIFTY_BP.interest_income_plus_imputed) * BigInt(pp.total_income_minor);
      pushRatio(verdict, { ratio: 'interest_based_debt', numerator_minor: totalDebt, denominator_minor: totalAssets, denominator_used: 'total_assets', threshold_bp: NIFTY_BP.interest_based_debt });
      pushRatio(verdict, { ratio: 'interest_income_plus_imputed', numerator_minor: Number(exactLhs / 10000n), denominator_minor: pp.total_income_minor, denominator_used: 'total_income', threshold_bp: NIFTY_BP.interest_income_plus_imputed, compliant: exactLhs <= exactRhs, numerator_rounding: 'floor_minor_unit' });
      pushRatio(verdict, { ratio: 'receivables_and_cash_bank', numerator_minor: receivables + cashIb, denominator_minor: totalAssets, denominator_used: 'total_assets', threshold_bp: NIFTY_BP.receivables_and_cash_bank });
    }

    // ── dividend purification, per profile, never merged ─────────────────────────
    if (dividendPresent && a !== 'ftse_idealratings') {
      if (a === 'msci_islamic' || a === 'msci_islamic_m') {
        const nonPermissible = pp.non_permissible_revenue_minor + pp.interest_income_minor;
        if (nonPermissible > pp.total_income_minor) {
          // The purification share would exceed the whole dividend; the caller's income
          // figures are inconsistent with any purification factor, so the leg refuses
          // rather than emitting a negative amount. The screening verdicts stand.
          verdict.purification = null;
          pushFlag(compliance_flags, 'PURIFICATION_INPUT_INCONSISTENT_MSCI');
          verdict.ratios.push({
            ratio: 'dividend_adjustment_factor',
            numerator_minor: null,
            denominator_minor: null,
            denominator_used: null,
            threshold_bp: null,
            comparison: null,
            compliant: null,
          });
        } else {
          const purified = mulDivFloor(pp.dividend_minor, nonPermissible, pp.total_income_minor);
          verdict.purification = {
            rule: 'dividend_adjustment_factor',
            dividend_minor: pp.dividend_minor,
            factor_numerator_minor: pp.total_income_minor - nonPermissible,
            factor_denominator_minor: pp.total_income_minor,
            purified_portion_minor: purified,
            purification_remainder_minor: mulDivRemainder(pp.dividend_minor, nonPermissible, pp.total_income_minor, purified),
            rounding: 'floor_minor_unit',
          };
        }
      } else if (a === 'nifty_tasis') {
        if (pp.interest_income_minor > pp.total_income_minor) {
          // Interest income above total income is a contradictory income statement; the
          // pro-rata purification share would exceed the whole dividend, so the leg refuses
          // rather than emitting an amount above the dividend. The screening verdicts stand.
          verdict.purification = null;
          pushFlag(compliance_flags, 'PURIFICATION_INPUT_INCONSISTENT_NIFTY');
          verdict.ratios.push({
            ratio: 'income_purification_ratio',
            numerator_minor: null,
            denominator_minor: null,
            denominator_used: null,
            threshold_bp: null,
            comparison: null,
            compliant: null,
          });
        } else {
          const purified = mulDivFloor(pp.dividend_minor, pp.interest_income_minor, pp.total_income_minor);
          verdict.purification = {
            rule: 'income_purification_ratio',
            dividend_minor: pp.dividend_minor,
            factor_numerator_minor: pp.interest_income_minor,
            factor_denominator_minor: pp.total_income_minor,
            purified_portion_minor: purified,
            purification_remainder_minor: mulDivRemainder(pp.dividend_minor, pp.interest_income_minor, pp.total_income_minor, purified),
            rounding: 'floor_minor_unit',
          };
        }
      }
    }
    verdicts[a] = verdict;
  }

  const output_payload = {
    valid_input: true,
    not_a_shariah_ruling: true,
    methodologies: selected.slice(),
    verdicts,
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

// Refusal shape: same fields, verdicts null, warnings mirror, never a ruling.
function refusalPayload(domain_errors, compliance_flags) {
  const flags = compliance_flags.slice();
  if (flags.indexOf('EQUITY_SCREEN_INPUT_OUT_OF_DECLARED_DOMAIN') === -1 && domain_errors.length > 0) {
    flags.push('EQUITY_SCREEN_INPUT_OUT_OF_DECLARED_DOMAIN');
  }
  return {
    output_payload: {
      valid_input: false,
      not_a_shariah_ruling: true,
      domain_errors,
      verdicts: null,
      purification: null,
      warnings: flags.slice(),
    },
    compliance_flags: flags,
  };
}

// ── artifact wrapper ─────────────────────────────────────────────────────────────
// `now` is passed in, never read from a clock. When the shared canonicalizer would refuse
// the {policy_parameters, output_payload} preimage, the artifact mints with a null
// execution_hash and the reason beside it instead of throwing (D6). compute() already
// refuses the same input; this is the backstop: buildArtifact never throws on any input.
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
