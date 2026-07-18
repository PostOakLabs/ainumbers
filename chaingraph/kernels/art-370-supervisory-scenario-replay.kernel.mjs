/**
 * art-370-supervisory-scenario-replay.kernel.mjs
 * DFAST-lite Supervisory Scenario Replay — replays the Fed's published 2026
 * 28-variable supervisory scenario paths against USER-SUPPLIED loss/PPNR
 * coefficient functions, producing a quarterly P&L and capital walk.
 *
 * THIS IS NOT THE FED'S MODEL, NOT A DFAST SUBMISSION, AND NOT A SUPERVISORY
 * RESULT. It replays user-declared linear functions over the Fed's officially
 * published scenario inputs. See fixtures/art-370-fed-2026-scenarios/provenance.json
 * for the source PDF, release date, and per-file digests.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random(),
 * no network access of any kind: scenario data is a build-time-pinned
 * constant, never retrieved at runtime. Cents-integer fixed-point discipline
 * throughout (house discipline: no float drift across a 13-quarter
 * cumulative walk).
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-370-supervisory-scenario-replay',
  mcp_name:     'replay_supervisory_scenario',
  mandate_type: 'capital_assessment',
  version:      '1.0.0',
};

const TOOL_ID      = 'art-370-supervisory-scenario-replay';
const TOOL_VERSION = '1.0.0';

// Source: Fed 2026 final supervisory stress test scenarios, released 2026-02-04.
// https://www.federalreserve.gov/publications/files/2026-final-supervisory-stress-test-scenarios-20260204.pdf
// Tables 3.A/3.B (baseline) and 4.A/4.B (severely adverse). 28 variables total
// (16 domestic + 12 international) x 13 quarters (Q1:2026-Q1:2029). Verbatim
// transcription; digest of the full 4-file fixture set below.
export const SCENARIO_SET_DIGEST = 'sha256:f09487a32bd73b5ac1293ff9496b6484ca0e0102c3829ddaf5bb7d76aa0595e8';
export const SCENARIO_SOURCE_URL = 'https://www.federalreserve.gov/publications/files/2026-final-supervisory-stress-test-scenarios-20260204.pdf';
export const SCENARIO_RELEASE_DATE = '2026-02-04';

const QUARTERS = ['2026Q1','2026Q2','2026Q3','2026Q4','2027Q1','2027Q2','2027Q3','2027Q4','2028Q1','2028Q2','2028Q3','2028Q4','2029Q1'];

const DOMESTIC_VARS = ['real_gdp_growth','nominal_gdp_growth','real_disposable_income_growth','nominal_disposable_income_growth','unemployment_rate','cpi_inflation_rate','treasury_3m_yield','treasury_5y_yield','treasury_10y_yield','bbb_corporate_yield','mortgage_rate','prime_rate','dow_jones_total_stock_market_index','house_price_index','cre_price_index','market_volatility_index'];
const INTL_VARS = ['euro_area_real_gdp_growth','euro_area_inflation','euro_usd_exchange_rate','developing_asia_real_gdp_growth','developing_asia_inflation','developing_asia_fx_index','japan_real_gdp_growth','japan_inflation','yen_usd_exchange_rate','uk_real_gdp_growth','uk_inflation','gbp_usd_exchange_rate'];

// Table 3.A (baseline domestic): real_gdp_growth, nominal_gdp_growth, real_disp_inc_growth,
// nominal_disp_inc_growth, unemployment_rate, cpi_inflation, 3m, 5y, 10y, BBB, mortgage, prime,
// DJ total stock market index, house price index, CRE price index, VIX.
const BASELINE_DOMESTIC = [
  [1.9,4.8,3.1,6.2,4.6,3.0,3.6,3.7,4.1,5.2,6.1,6.6,68299,325,310,23.0],
  [1.9,4.5,2.1,4.8,4.6,2.7,3.4,3.6,4.1,5.3,6.0,6.4,69057,326,313,22.0],
  [2.0,4.5,1.9,4.5,4.6,2.6,3.2,3.7,4.1,5.3,6.0,6.2,69820,326,316,21.9],
  [2.0,4.5,2.2,4.6,4.5,2.5,3.1,3.7,4.1,5.4,6.0,6.1,70592,327,320,22.1],
  [2.1,4.5,2.4,4.8,4.5,2.5,3.1,3.7,4.1,5.4,5.9,6.1,71366,327,323,22.5],
  [2.1,4.4,2.3,4.6,4.4,2.3,3.1,3.7,4.1,5.5,5.9,6.1,72138,327,327,22.9],
  [2.0,4.3,2.2,4.4,4.3,2.4,3.1,3.8,4.1,5.5,5.8,6.1,72895,327,330,23.2],
  [2.0,4.3,2.2,4.4,4.3,2.3,3.1,3.9,4.2,5.6,5.8,6.1,73664,328,334,23.5],
  [2.0,4.2,2.1,4.4,4.3,2.2,3.1,3.9,4.1,5.6,5.8,6.1,74419,328,337,23.8],
  [2.0,4.1,2.1,4.4,4.3,2.2,3.0,3.9,4.1,5.6,5.8,6.0,75174,328,341,24.1],
  [2.0,4.1,2.1,4.3,4.3,2.2,3.0,3.9,4.1,5.6,5.7,6.0,75929,329,344,24.3],
  [2.0,4.0,2.1,4.3,4.3,2.2,3.0,3.9,4.1,5.6,5.7,6.0,76684,329,347,24.5],
  [1.9,4.1,2.1,4.3,4.2,2.2,3.0,3.9,4.1,5.6,5.7,6.0,77451,330,351,24.6],
];

// Table 4.A (severely adverse domestic), same column order.
const SEVERELY_ADVERSE_DOMESTIC = [
  [-5.4,-3.1,-0.9,1.4,5.9,2.5,2.5,2.4,3.1,7.5,6.0,5.5,41364,303,291,59.7],
  [-4.9,-3.3,-1.1,0.5,7.2,1.8,0.1,1.8,2.7,8.2,5.9,3.1,34732,283,276,72.0],
  [-3.8,-2.9,-0.7,0.2,8.2,1.1,0.1,1.4,2.4,8.1,5.8,3.1,28490,273,261,70.9],
  [-2.7,-1.9,-0.3,0.5,9.0,1.0,0.1,1.3,2.3,7.9,5.7,3.1,31161,263,246,66.6],
  [-1.4,-0.5,0.3,1.2,9.5,1.1,0.1,1.3,2.3,7.5,5.6,3.1,33832,254,232,62.3],
  [-0.3,0.6,0.7,1.6,9.9,1.1,0.1,1.3,2.3,7.1,5.5,3.1,36503,244,217,58.1],
  [1.1,2.0,1.5,2.3,10.0,1.1,0.1,1.3,2.4,6.7,5.4,3.1,39174,236,202,53.8],
  [3.0,3.9,2.4,3.2,9.8,1.1,0.1,1.3,2.4,6.3,5.3,3.1,41845,227,187,49.5],
  [4.0,4.9,2.9,3.8,9.4,1.1,0.1,1.3,2.4,5.9,5.3,3.1,44516,231,189,45.3],
  [4.0,5.0,2.9,3.9,9.1,1.2,0.1,1.3,2.5,5.5,5.2,3.1,47187,235,191,41.0],
  [4.0,5.1,2.9,3.9,8.7,1.2,0.1,1.4,2.5,5.2,5.2,3.1,49858,238,193,36.7],
  [4.0,5.1,2.9,4.0,8.4,1.3,0.1,1.4,2.6,4.8,5.1,3.1,52529,242,195,32.5],
  [3.9,5.1,2.8,4.0,8.0,1.3,0.1,1.5,2.7,4.5,5.1,3.1,55200,246,196,28.2],
];

// Table 3.B (baseline international): euro_gdp, euro_infl, eur_usd, dev_asia_gdp, dev_asia_infl,
// dev_asia_fx, japan_gdp, japan_infl, yen_usd, uk_gdp, uk_infl, gbp_usd.
const BASELINE_INTL = [
  [1.1,1.8,1.176,4.4,1.2,106.9,0.8,1.9,155.5,1.1,2.5,1.344],
  [1.5,1.8,1.179,5.0,1.4,107.0,0.9,1.8,154.2,1.3,2.2,1.344],
  [1.7,1.8,1.182,5.2,1.5,107.1,0.9,1.8,153.0,1.4,2.1,1.343],
  [1.6,1.9,1.185,4.9,1.5,107.1,0.9,1.9,151.7,1.4,2.0,1.343],
  [1.5,1.9,1.186,4.3,1.6,106.9,0.9,1.9,150.0,1.4,2.1,1.346],
  [1.4,2.0,1.187,3.9,1.7,106.6,0.8,1.9,148.2,1.4,2.1,1.350],
  [1.3,2.0,1.188,3.9,1.8,106.4,0.8,1.9,146.5,1.4,2.1,1.353],
  [1.3,2.0,1.189,4.1,1.9,106.2,0.8,1.9,144.8,1.4,2.1,1.356],
  [1.4,1.9,1.189,4.4,2.0,106.2,0.7,1.9,144.8,1.3,2.0,1.356],
  [1.4,1.9,1.189,4.6,2.0,106.2,0.6,1.8,144.8,1.3,2.0,1.356],
  [1.4,1.9,1.189,4.6,2.1,106.2,0.6,1.8,144.8,1.3,2.0,1.356],
  [1.4,1.9,1.189,4.5,2.1,106.2,0.7,1.8,144.8,1.3,2.0,1.356],
  [1.3,1.9,1.189,4.1,2.1,106.2,0.7,1.8,144.8,1.3,2.0,1.356],
];

// Table 4.B (severely adverse international), same column order.
const SEVERELY_ADVERSE_INTL = [
  [-8.6,0.5,1.124,0.4,-1.0,111.5,-9.1,0.5,156.3,-8.8,0.9,1.288],
  [-8.5,-0.4,1.080,0.4,-2.4,116.1,-9.1,-0.4,155.9,-8.7,-0.1,1.237],
  [-6.7,-1.0,1.043,1.4,-3.3,120.3,-7.3,-1.0,155.5,-6.9,-0.8,1.195],
  [-0.5,-1.1,1.021,4.7,-3.5,122.9,-1.1,-1.2,155.2,-0.5,-1.0,1.169],
  [1.5,-0.9,1.021,5.8,-3.0,122.8,0.9,-0.9,155.2,1.5,-0.8,1.170],
  [1.5,-0.5,1.035,5.8,-2.4,121.2,0.9,-0.6,155.4,1.5,-0.4,1.185],
  [1.4,-0.1,1.054,5.7,-1.7,119.0,0.8,-0.2,155.6,1.4,0.0,1.207],
  [1.3,0.2,1.074,5.7,-1.0,116.7,0.7,0.2,155.8,1.3,0.3,1.231],
  [1.3,0.6,1.094,5.7,-0.4,114.6,0.7,0.5,156.0,1.3,0.7,1.254],
  [1.3,0.9,1.114,5.7,0.2,112.6,0.7,0.8,156.2,1.3,1.0,1.276],
  [1.3,1.2,1.134,5.7,0.8,110.6,0.7,1.2,156.4,1.3,1.3,1.299],
  [1.3,1.6,1.153,5.7,1.5,108.7,0.7,1.5,156.6,1.3,1.7,1.322],
  [1.3,1.9,1.174,5.7,2.1,106.8,0.7,1.8,156.8,1.3,2.0,1.345],
];

function buildScenario(domesticRows, intlRows) {
  return QUARTERS.map((date, i) => {
    const vars = {};
    DOMESTIC_VARS.forEach((name, j) => { vars[name] = domesticRows[i][j]; });
    INTL_VARS.forEach((name, j) => { vars[name] = intlRows[i][j]; });
    return { date, vars };
  });
}

const SCENARIOS = {
  baseline: buildScenario(BASELINE_DOMESTIC, BASELINE_INTL),
  severely_adverse: buildScenario(SEVERELY_ADVERSE_DOMESTIC, SEVERELY_ADVERSE_INTL),
};

export const ALL_VARIABLE_NAMES = [...DOMESTIC_VARS, ...INTL_VARS];

// ── fixed-point money helpers (cents-integer discipline) ─────────────────────
function safeNum(v, fallback = 0) { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }
function toCents(dollarsMn) { return Math.round(safeNum(dollarsMn, 0) * 100); }
function fromCents(cents) { return Number.isFinite(cents) ? Math.round(cents) / 100 : 0; }

// Evaluates a declared linear coefficient function over one quarter's 28 macro
// variables: intercept + sum(coefficient_i * variable_i). Missing coefficients
// default to 0 (no contribution). Result is in cents-of-$mn (fixed-point).
function evalCoefficientFnCents(fn, vars) {
  const intercept = safeNum(fn && fn.intercept, 0);
  const coefficients = (fn && typeof fn.coefficients === 'object' && fn.coefficients) || {};
  let sumCents = toCents(intercept);
  for (const name of ALL_VARIABLE_NAMES) {
    const coef = safeNum(coefficients[name], 0);
    if (coef === 0) continue;
    sumCents += toCents(coef * safeNum(vars[name], 0));
  }
  return sumCents;
}

export function compute(pp) {
  const scenarioName = (pp && pp.scenario === 'baseline') ? 'baseline' : 'severely_adverse';
  const path = SCENARIOS[scenarioName];

  const startingCapitalCents = toCents(safeNum(pp && pp.starting_capital_mn, 0));
  const rwaMn = Math.max(0, safeNum(pp && pp.rwa_mn, 0));
  const taxRate = Math.min(0.5, Math.max(0, safeNum(pp && pp.tax_rate, 0.21)));
  const quarterlyDistributionCents = toCents(safeNum(pp && pp.quarterly_distribution_mn, 0));

  const lossFn = (pp && pp.loss_function) || { intercept: 0, coefficients: {} };
  const ppnrFn = (pp && pp.ppnr_function) || { intercept: 0, coefficients: {} };

  let capitalCents = startingCapitalCents;
  let minCapitalCents = startingCapitalCents;
  let minCapitalQuarter = null;
  const quarters = [];

  for (const q of path) {
    const lossCents = Math.max(0, evalCoefficientFnCents(lossFn, q.vars)); // losses are a non-negative draw against income
    const ppnrCents = evalCoefficientFnCents(ppnrFn, q.vars);
    const pretaxIncomeCents = ppnrCents - lossCents;
    const taxCents = pretaxIncomeCents > 0 ? Math.round(pretaxIncomeCents * taxRate) : 0;
    const netIncomeCents = pretaxIncomeCents - taxCents;
    capitalCents = capitalCents + netIncomeCents - quarterlyDistributionCents;
    if (capitalCents < minCapitalCents) { minCapitalCents = capitalCents; minCapitalQuarter = q.date; }
    const capitalRatioPct = rwaMn > 0 ? +((fromCents(capitalCents) / rwaMn) * 100).toFixed(4) : null;
    quarters.push({
      date: q.date,
      ppnr_mn: fromCents(ppnrCents),
      loss_mn: fromCents(lossCents),
      pretax_income_mn: fromCents(pretaxIncomeCents),
      net_income_mn: fromCents(netIncomeCents),
      capital_mn: fromCents(capitalCents),
      capital_ratio_pct: capitalRatioPct,
    });
  }

  const troughCapitalRatioPct = rwaMn > 0 ? +((fromCents(minCapitalCents) / rwaMn) * 100).toFixed(4) : null;

  return {
    scenario: scenarioName,
    scenario_set_digest: SCENARIO_SET_DIGEST,
    scenario_source_url: SCENARIO_SOURCE_URL,
    scenario_release_date: SCENARIO_RELEASE_DATE,
    starting_capital_mn: fromCents(startingCapitalCents),
    ending_capital_mn: fromCents(capitalCents),
    trough_capital_mn: fromCents(minCapitalCents),
    trough_quarter: minCapitalQuarter,
    trough_capital_ratio_pct: troughCapitalRatioPct,
    quarters,
    not_a_submission: 'This is a replay of user-supplied loss/PPNR functions over the Fed\'s published scenario paths. It is not the Fed\'s model, not a DFAST submission, and not a supervisory result.',
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags: ['NOT_A_DFAST_SUBMISSION', 'USER_SUPPLIED_LOSS_PPNR_FUNCTIONS'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
