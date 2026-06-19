/**
 * qfa-03-stress-test-engine.kernel.mjs
 * Stress Test Engine — LCG + Box-Muller, historical scenario + MC stressed VaR.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

export const meta = {
  tool_id:      'qfa-03-stress-test-engine',
  mcp_name:     'compute_stress_test_scenarios',
  mandate_type: 'risk_parameter',
  version:      '1.0.0',
};

// ── LCG + Box-Muller (matches source HTML) ────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randn(rng) {
  const u1 = rng(), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
}

// ── Scenario library (from source SCENARIOS) ──────────────────────────────────
const SCENARIOS = [
  { id:'gfc_2008',    label:'GFC Peak (Oct 2008)',      equityShock:-0.42, creditShock:0.06,  rateShock:-0.020, volMult:3.0, horizon:10 },
  { id:'covid_2020',  label:'COVID Crash (Mar 2020)',   equityShock:-0.34, creditShock:0.03,  rateShock:-0.015, volMult:2.8, horizon:10 },
  { id:'dotcom_bust', label:'Dot-com Bust (2000–02)',   equityShock:-0.45, creditShock:0.012, rateShock:-0.025, volMult:2.2, horizon:20 },
  { id:'lehman_week', label:'Lehman Week (Sep 2008)',   equityShock:-0.10, creditShock:0.035, rateShock: 0.005, volMult:4.5, horizon:5  },
  { id:'rate_shock',  label:'Rate Shock (2022)',        equityShock:-0.20, creditShock:0.018, rateShock: 0.040, volMult:1.8, horizon:20 },
  { id:'svb_2023',    label:'SVB Contagion (Mar 2023)', equityShock:-0.30, creditShock:0.020, rateShock: 0.005, volMult:2.4, horizon:5  },
];

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  small_desk:  { nAssets:20,  portVol:0.15, equityBeta:0.6, creditSens:0.25, rateDur:3,  mcPaths:1000, confLevel:0.99, seed:42  },
  medium_book: { nAssets:60,  portVol:0.18, equityBeta:0.4, creditSens:0.5,  rateDur:5,  mcPaths:1000, confLevel:0.99, seed:137 },
  large_inst:  { nAssets:150, portVol:0.22, equityBeta:0.3, creditSens:0.25, rateDur:8,  mcPaths:2000, confLevel:0.99, seed:999 },
};

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const presetName   = pp.preset;
  const pDef         = presetName ? PRESETS[presetName] : null;

  const nAssets      = pp.n_assets      ?? pDef?.nAssets      ?? 20;
  const portVol      = pp.portfolio_vol ?? pDef?.portVol      ?? 0.15;
  const equityBeta   = pp.equity_beta   ?? pDef?.equityBeta   ?? 0.6;
  const creditSens   = pp.credit_sensitivity ?? pDef?.creditSens ?? 0.25;
  const rateDur      = pp.rate_duration_yrs  ?? pDef?.rateDur  ?? 3;
  const mcPaths      = Math.min(Math.max(pp.mc_paths ?? pDef?.mcPaths ?? 1000, 100), 5000);
  const confLevel    = pp.confidence_level ?? pDef?.confLevel ?? 0.99;
  const seed         = pp.seed           ?? pDef?.seed        ?? 42;

  const rng0 = makeLCG(seed);

  // ── Normal VaR baseline ────────────────────────────────────────────────────
  const normalPnls = new Float64Array(mcPaths);
  for (let s = 0; s < mcPaths; s++) {
    normalPnls[s] = randn(rng0) * portVol * Math.sqrt(10 / 250);
  }
  const sortedNormal = [...normalPnls].sort((a, b) => a - b);
  const varCount     = Math.max(1, Math.floor(mcPaths * (1 - confLevel)));
  const normalVar    = -sortedNormal[varCount - 1];

  // ── Historical scenario losses ─────────────────────────────────────────────
  const scenarioResults = [];
  for (let si = 0; si < SCENARIOS.length; si++) {
    const sc = SCENARIOS[si];
    const equityLoss = equityBeta  * Math.abs(sc.equityShock) * portVol / 0.15;
    const creditLoss = creditSens  * sc.creditShock * 10;
    const rateLoss   = rateDur     * Math.abs(sc.rateShock);
    const totalLoss  = Math.min(equityLoss + creditLoss + rateLoss, 0.90);

    const rngS = makeLCG(seed + si * 100 + 1);
    const sPnls = [];
    for (let s = 0; s < mcPaths; s++) {
      const normal  = randn(rngS) * portVol * sc.volMult * Math.sqrt(sc.horizon / 250);
      const shifted = normal - totalLoss;
      sPnls.push(shifted);
    }
    sPnls.sort((a, b) => a - b);
    const sVarCount = Math.max(1, Math.floor(mcPaths * (1 - confLevel)));
    const sVar      = -sPnls[sVarCount - 1];
    const esAvg     = -sPnls.slice(0, sVarCount).reduce((a, b) => a + b, 0) / sVarCount;
    const recoveryDays = Math.round(totalLoss / (portVol * 0.0005));

    scenarioResults.push({
      ...sc,
      equityLoss:  +equityLoss.toFixed(6),
      creditLoss:  +creditLoss.toFixed(6),
      rateLoss:    +rateLoss.toFixed(6),
      totalLoss:   +totalLoss.toFixed(6),
      stressedVar: +sVar.toFixed(6),
      stressedES:  +esAvg.toFixed(6),
      recoveryDays,
    });
  }

  // ── Aggregate MC stressed distribution (worst scenario) ───────────────────
  const worstSc = scenarioResults.reduce((a, b) => b.totalLoss > a.totalLoss ? b : a);

  const rngAgg = makeLCG(seed + 9999);
  const aggPnls = [];
  for (let s = 0; s < mcPaths; s++) {
    const n = randn(rngAgg) * portVol * worstSc.volMult * Math.sqrt(worstSc.horizon / 250);
    aggPnls.push(n - worstSc.totalLoss);
  }
  aggPnls.sort((a, b) => a - b);
  const aggVarCount   = Math.max(1, Math.floor(mcPaths * (1 - confLevel)));
  const aggStressVar  = -aggPnls[aggVarCount - 1];
  const aggStressES   = -aggPnls.slice(0, aggVarCount).reduce((a, b) => a + b, 0) / aggVarCount;
  const stressMultiplier = normalVar > 0 ? aggStressVar / normalVar : 1;

  // ── Verdict ───────────────────────────────────────────────────────────────
  let verdict;
  if (stressMultiplier >= 3.0 || worstSc.totalLoss >= 0.30)      verdict = 'HIGH_STRESS_EXPOSURE';
  else if (stressMultiplier >= 1.8 || worstSc.totalLoss >= 0.15) verdict = 'MODERATE_STRESS_EXPOSURE';
  else                                                              verdict = 'CONTAINED_STRESS_EXPOSURE';

  const scenario_losses = Object.fromEntries(
    scenarioResults.map(s => [s.id, +s.totalLoss.toFixed(6)])
  );

  const compliance_flags = [];
  if (stressMultiplier >= 3.0) compliance_flags.push('PILLAR2_CAPITAL_BUFFER_REQUIRED');
  else if (stressMultiplier >= 1.8) compliance_flags.push('PILLAR2_CAPITAL_ADD_ON_ADVISABLE');
  else compliance_flags.push('STRESS_TEST_CONTAINED');
  compliance_flags.push('EBA_GL_2018_04_STRESS_TEST_APPLIED');
  compliance_flags.push('BASEL3_PILLAR2_ICAAP_STRESS_ASSESSED');

  return {
    verdict,
    worst_case_scenario:  worstSc.id,
    worst_case_loss:      +worstSc.totalLoss.toFixed(6),
    stressed_var_pct:     +aggStressVar.toFixed(6),
    stressed_es_pct:      +aggStressES.toFixed(6),
    normal_var_pct:       +normalVar.toFixed(6),
    stress_multiplier:    +stressMultiplier.toFixed(4),
    max_drawdown:         +worstSc.totalLoss.toFixed(6),
    recovery_days_estimate: worstSc.recoveryDays,
    scenario_losses,
    scenario_details:     scenarioResults,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:               meta.tool_id,
    mandate_type:          meta.mandate_type,
    verdict:               r.verdict,
    worst_case_scenario:   r.worst_case_scenario,
    worst_case_loss:       r.worst_case_loss,
    stressed_var_pct:      r.stressed_var_pct,
    stressed_es_pct:       r.stressed_es_pct,
    normal_var_pct:        r.normal_var_pct,
    stress_multiplier:     r.stress_multiplier,
    max_drawdown:          r.max_drawdown,
    recovery_days_estimate: r.recovery_days_estimate,
    scenario_losses:       r.scenario_losses,
    compliance_flags:      r.compliance_flags,
    inputs:                pp,
  };
}
