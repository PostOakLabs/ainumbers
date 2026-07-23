import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-426-cecl-ecl-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_cecl_ecl_allowance',
  mandate_type: 'credit_assessment', gpu: false,
};

// CECL (Current Expected Credit Loss, ASC 326) allowance calculator, per
// BANKING-OCG-BUILD-SPEC.md §3.2. Computes a deterministic ECL allowance given
// user-supplied PD/LGD/EAD curves, segment exposures, and forecast scenario
// weights -- WARM (Weighted-Average Remaining Maturity, a historical-loss-rate
// x remaining-life practical-expedient approach), DCF (full contractual
// cash-flow projection discounted at the effective interest rate), and
// straight loss-rate (lifetime historical loss rate applied directly, no
// discounting). BOUNDARY: PD/LGD/EAD curves and forecast scenario weights are
// POLICY INPUTS supplied by the caller (human/model judgment) -- this kernel
// performs ONLY the arithmetic combination into per-segment ECL and the
// allowance rollforward reconciliation against the prior period's balance. It
// does not estimate, calibrate, back-test, or validate any PD/LGD/EAD model,
// and it does not perform IFRS9's 3-stage staging transfer logic (CECL
// recognizes lifetime expected credit losses from origination, not a 3-stage
// regime -- see tools 196/198/204 for the IFRS9 analog, a DIFFERENT regime).
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/toLocaleString.

const METHODS = ['warm', 'dcf', 'loss_rate'];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// Iterative discount factor (1+rate)^periods -- avoids Math.pow, deterministic
// integer-step multiplication only.
function discountFactor(ratePerPeriod, periods) {
  let df = 1;
  const n = Number.isFinite(periods) && periods > 0 ? Math.floor(periods) : 0;
  for (let i = 0; i < n; i++) df *= (1 + ratePerPeriod);
  return df;
}

// Normalize scenario weights: prefer the top-level forecast_weights POLICY
// INPUT (matched by scenario name), fall back to a per-scenario weight field,
// fall back to equal split. Always returns weights summing to 1 (or an equal
// split if nothing usable was supplied).
function normalizeWeights(scenarios, forecastWeightsMap) {
  const n = scenarios.length || 1;
  const equalSplit = () => scenarios.map(() => 1 / n);
  if (scenarios.length === 0) return [];
  const raw = scenarios.map((s) => {
    if (forecastWeightsMap.has(s.scenario)) return forecastWeightsMap.get(s.scenario);
    if (Number.isFinite(s.weight)) return s.weight;
    return null;
  });
  const filled = raw.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = filled.reduce((a, v) => a + v, 0);
  if (sum <= 0) return equalSplit();
  return filled.map((v) => v / sum);
}

function computeScenarioEclUsd(method, segment, scenario) {
  const eadUsd = safeNum(segment.ead_usd, segment.exposure_balance_usd);
  if (method === 'warm') {
    const annualLossRatePct = clamp01(safeNum(scenario.annual_loss_rate_pct, 0));
    const remainingLifeYears = Math.max(0, safeNum(segment.remaining_life_years, 0));
    return eadUsd * annualLossRatePct * remainingLifeYears;
  }
  if (method === 'loss_rate') {
    const lifetimeLossRatePct = clamp01(safeNum(scenario.lifetime_loss_rate_pct, 0));
    return eadUsd * lifetimeLossRatePct;
  }
  // dcf
  const lgdPct = clamp01(safeNum(segment.lgd_pct, 0));
  const eirRate = safeNum(segment.effective_interest_rate_pct, 0) / 100;
  const pdCurve = Array.isArray(scenario.pd_curve) ? scenario.pd_curve.map((p) => clamp01(safeNum(p, 0))) : [];
  const cashFlowsRaw = Array.isArray(scenario.cash_flows) ? scenario.cash_flows : [];
  const cashFlows = cashFlowsRaw
    .map((cf) => ({ period: Math.max(1, Math.floor(safeNum(cf && cf.period, 0))), contractual_payment_usd: safeNum(cf && cf.contractual_payment_usd, 0) }))
    .filter((cf) => cf.period > 0)
    .sort((a, b) => a.period - b.period);
  let pvExpectedShortfall = 0;
  for (const cf of cashFlows) {
    const pdPeriod = pdCurve.length > 0 ? (pdCurve[cf.period - 1] != null ? pdCurve[cf.period - 1] : pdCurve[pdCurve.length - 1]) : 0;
    const expectedShortfallUsd = cf.contractual_payment_usd * pdPeriod * lgdPct;
    const df = discountFactor(eirRate, cf.period);
    pvExpectedShortfall += df > 0 ? expectedShortfallUsd / df : expectedShortfallUsd;
  }
  return pvExpectedShortfall;
}

export function compute(pp) {
  pp = pp || {};
  const rawMethod = String(pp.method || 'warm').trim().toLowerCase();
  const method = METHODS.includes(rawMethod) ? rawMethod : 'warm';
  const constantsVersion = String(pp.constants_version || '').trim();
  const priorAllowanceBalanceUsd = safeNum(pp.prior_allowance_balance_usd, 0);
  const chargeOffsUsd = safeNum(pp.charge_offs_usd, 0);
  const recoveriesUsd = safeNum(pp.recoveries_usd, 0);
  const forecastWeightsRaw = Array.isArray(pp.forecast_weights) ? pp.forecast_weights : [];
  const forecastWeightsMap = new Map();
  for (const w of forecastWeightsRaw) {
    if (w && typeof w.scenario === 'string' && Number.isFinite(Number(w.weight))) {
      forecastWeightsMap.set(w.scenario, Number(w.weight));
    }
  }
  const segmentsRaw = Array.isArray(pp.segments) ? pp.segments : [];

  const compliance_flags = [];
  if (!METHODS.includes(rawMethod)) compliance_flags.push('CECL_INVALID_METHOD_DEFAULTED_WARM');
  if (segmentsRaw.length === 0) compliance_flags.push('CECL_EMPTY_SEGMENTS');
  if (!constantsVersion) compliance_flags.push('CECL_CONSTANTS_VERSION_UNPINNED');
  if (forecastWeightsRaw.length === 0) compliance_flags.push('CECL_FORECAST_WEIGHTS_UNPINNED');

  const segments = segmentsRaw.map((seg) => {
    seg = seg || {};
    const segmentId = String(seg.segment_id || '').trim();
    const exposureBalanceUsd = safeNum(seg.exposure_balance_usd, 0);
    const eadUsd = safeNum(seg.ead_usd, exposureBalanceUsd);
    const remainingLifeYears = Math.max(0, safeNum(seg.remaining_life_years, 0));
    const lgdPct = clamp01(safeNum(seg.lgd_pct, 0));
    const scenariosRaw = Array.isArray(seg.scenarios) ? seg.scenarios : [];
    const scenarios = scenariosRaw.map((s) => s || {});
    if (scenarios.length === 0) compliance_flags.push('CECL_SEGMENT_NO_SCENARIOS_' + (segmentId || 'UNNAMED'));

    const weights = normalizeWeights(scenarios, forecastWeightsMap);
    const scenarioResults = scenarios.map((s, i) => ({
      scenario: String(s.scenario || ('scenario_' + i)).trim(),
      weight: r6(weights[i] || 0),
      scenario_ecl_usd: r2(computeScenarioEclUsd(method, { exposure_balance_usd: exposureBalanceUsd, ead_usd: eadUsd, remaining_life_years: remainingLifeYears, lgd_pct: lgdPct, effective_interest_rate_pct: seg.effective_interest_rate_pct }, s)),
    }));
    const segmentEclUsd = scenarios.reduce((acc, s, i) => acc + computeScenarioEclUsd(method, { exposure_balance_usd: exposureBalanceUsd, ead_usd: eadUsd, remaining_life_years: remainingLifeYears, lgd_pct: lgdPct, effective_interest_rate_pct: seg.effective_interest_rate_pct }, s) * weights[i], 0);

    return {
      segment_id: segmentId,
      exposure_balance_usd: r2(exposureBalanceUsd),
      ead_usd: r2(eadUsd),
      remaining_life_years: remainingLifeYears,
      lgd_pct: lgdPct,
      scenario_count: scenarios.length,
      scenarios: scenarioResults,
      segment_ecl_usd: r2(segmentEclUsd),
    };
  });

  const totalRequiredAllowanceUsd = segments.reduce((a, s) => a + s.segment_ecl_usd, 0);
  if (totalRequiredAllowanceUsd < 0) compliance_flags.push('CECL_NEGATIVE_REQUIRED_ALLOWANCE');

  // Allowance rollforward reconciliation: provision is the plug that reconciles
  // the beginning balance (net of charge-offs/recoveries) to the newly computed
  // required allowance. By construction the reconciled ending balance always
  // equals the required allowance; delta_vs_required_usd is a sanity readout
  // (should be ~0) rather than an independent check.
  const provisionExpenseUsd = totalRequiredAllowanceUsd - priorAllowanceBalanceUsd + chargeOffsUsd - recoveriesUsd;
  const reconciledEndingAllowanceUsd = priorAllowanceBalanceUsd + provisionExpenseUsd - chargeOffsUsd + recoveriesUsd;
  const deltaVsRequiredUsd = reconciledEndingAllowanceUsd - totalRequiredAllowanceUsd;
  const reconciliationBalanced = Math.abs(deltaVsRequiredUsd) < 0.005;
  if (!reconciliationBalanced) compliance_flags.push('CECL_RECONCILIATION_UNBALANCED');

  const output_payload = {
    method,
    constants_version: constantsVersion,
    segment_count: segments.length,
    segments,
    forecast_weights: forecastWeightsRaw.map((w) => ({ scenario: String((w && w.scenario) || ''), weight: safeNum(w && w.weight, 0) })),
    total_required_allowance_usd: r2(totalRequiredAllowanceUsd),
    prior_allowance_balance_usd: r2(priorAllowanceBalanceUsd),
    charge_offs_usd: r2(chargeOffsUsd),
    recoveries_usd: r2(recoveriesUsd),
    provision_expense_usd: r2(provisionExpenseUsd),
    reconciled_ending_allowance_usd: r2(reconciledEndingAllowanceUsd),
    delta_vs_required_usd: r2(deltaVsRequiredUsd),
    reconciliation_balanced: reconciliationBalanced,
    boundary_note: 'PD/LGD/EAD curves and forecast scenario weights are policy inputs supplied by the caller (human/model judgment); this kernel performs only the arithmetic combination into ECL and allowance reconciliation. It does not estimate, calibrate, or validate any PD/LGD/EAD model.',
    disambiguation: 'CECL (ASC 326) recognizes lifetime expected credit losses from origination -- there is no 3-stage staging transfer regime here, unlike IFRS9 (see tools 196/198/204, a distinct standard). WARM applies an annualized historical loss rate x remaining life; loss-rate applies a lifetime historical loss rate directly (no discounting); DCF discounts period expected shortfalls (contractual cash flow x PD x LGD) at the effective interest rate.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
