/**
 * 504-settlement-risk-capital-optimizer.kernel.mjs
 * Settlement-Risk Capital Efficiency Optimizer — SA-CCR / CRE70 / atomic DvP comparison.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      '504-settlement-risk-capital-optimizer',
  mcp_name:     'optimize_settlement_capital',
  mandate_type: 'capital_assessment',
  version:      '1.0.0',
};

// SA-CCR supervisory add-on factors by asset class (CRE52, 2yr tenor)
const ADDON_FACTORS = {
  ir:  0.0100,
  fx:  0.0400,
  eq:  0.2000,
  cr:  0.0038,
  com: 0.1800,
};
const ADDON_SIMPLIFIED = 0.10; // fallback when class unknown

// Settlement day lookup
const SETTLE_DAYS = {
  t0:           0,
  t1:           1,
  t2:           2,
  bilateral_repo: 2,
};

// Risk weights by rating
const RISK_WEIGHTS = {
  aaa:     0.20,
  aa:      0.20,
  a:       0.50,
  bbb:     1.00,
  unrated: 1.00,
  bb:      1.50,
  b:       1.50,
};

// SA-CCR alpha
const ALPHA = 1.4;

// CRE70 bilateral repo haircut
const CRE70_BILATERAL_REPO_WEIGHT = 0.08;

// CET1 cost assumptions
const DEFAULT_CET1 = 0.125;   // 12.5%
const DEFAULT_COC  = 0.10;    // 10% cost of capital

// Instrument → asset class inference
function inferAssetClass(name) {
  const n = (name || '').toLowerCase();
  if (/ir|interest rate|swap|irs|swaption|cap |floor |fra /.test(n)) return 'ir';
  if (/fx|forex|foreign exchange|ccy|cross.?curr/.test(n)) return 'fx';
  if (/equit|stock|share|equity/.test(n)) return 'eq';
  if (/credit|cds|cls|bond/.test(n)) return 'cr';
  if (/comm|oil|gold|metal|agri/.test(n)) return 'com';
  return null;
}

function calcRow(row, cet1Ratio, costOfCapital) {
  const notional     = Number(row.notional_usd) || 0;
  const rating       = (row.rating || 'unrated').toLowerCase();
  const settlementType = (row.settlement_type || 't2').toLowerCase();
  const instrument   = row.instrument || '';
  const isAtomicDvP  = settlementType === 't0';
  const isCollateral  = !!row.collateralised;

  // Asset class
  const assetClass = inferAssetClass(instrument);
  const addOnFactor = assetClass ? ADDON_FACTORS[assetClass] : ADDON_SIMPLIFIED;

  const settleDays = SETTLE_DAYS[settlementType] ?? 2;

  // Risk weight (halved if collateralised)
  let rw = RISK_WEIGHTS[rating] ?? 1.00;
  if (isCollateral) rw = rw * 0.5;

  // Legacy (pre-atomic) calculations
  const pfe_legacy    = settleDays > 0
    ? notional * addOnFactor * Math.sqrt(settleDays / 252)
    : 0;
  const ead_saccr_legacy = ALPHA * pfe_legacy;
  const cre70_legacy  = settlementType === 'bilateral_repo'
    ? notional * CRE70_BILATERAL_REPO_WEIGHT
    : 0;
  const totalEad_legacy = ead_saccr_legacy + cre70_legacy;
  const rwa_legacy      = totalEad_legacy * rw;
  const capital_legacy  = rwa_legacy * cet1Ratio;
  const annualCost_legacy = capital_legacy * costOfCapital;

  // Atomic (Canton T+0): EAD = 0
  const ead_atomic   = 0;
  const cre70_atomic = 0;
  const rwa_atomic   = 0;
  const capital_atomic = 0;
  const annualCost_atomic = 0;

  // Deltas
  const ead_delta      = isAtomicDvP ? 0 : totalEad_legacy;
  const rwa_delta      = isAtomicDvP ? 0 : rwa_legacy;
  const capital_freed  = isAtomicDvP ? 0 : capital_legacy;
  const annual_saving  = isAtomicDvP ? 0 : annualCost_legacy;

  // Compliance flags per row
  const flags = [];
  const bps = notional > 0 ? (annual_saving / notional) * 10_000 : 0;
  if (bps > 5)  flags.push('MATERIAL_CAPITAL_SAVING');
  if (bps < 1)  flags.push('IMMATERIAL_SAVING');
  if (/token|dlr|on.?chain/i.test(instrument)) flags.push('BCBS_SCO60_TREATMENT_FLAGGED');

  return {
    instrument,
    notional_usd:         notional,
    settlement_type:      settlementType,
    asset_class:          assetClass ?? 'simplified',
    rating,
    risk_weight:          rw,
    settle_days:          settleDays,
    pfe_legacy_usd:       +pfe_legacy.toFixed(2),
    ead_legacy_usd:       +totalEad_legacy.toFixed(2),
    rwa_legacy_usd:       +rwa_legacy.toFixed(2),
    capital_legacy_usd:   +capital_legacy.toFixed(2),
    ead_atomic_usd:       ead_atomic,
    rwa_delta_usd:        +rwa_delta.toFixed(2),
    capital_freed_usd:    +capital_freed.toFixed(2),
    annual_saving_usd:    +annual_saving.toFixed(2),
    saving_bps:           +bps.toFixed(2),
    flags,
  };
}

export function compute(pp) {
  // pp: { positions: Array<row>, cet1_ratio?, cost_of_capital? }
  const cet1Ratio     = Number(pp.cet1_ratio)     || DEFAULT_CET1;
  const costOfCapital = Number(pp.cost_of_capital) || DEFAULT_COC;

  const positions = Array.isArray(pp.positions) ? pp.positions : [];
  const rows = positions.map(r => calcRow(r, cet1Ratio, costOfCapital));

  const totalNotional    = rows.reduce((a, r) => a + r.notional_usd, 0);
  const totalRwaDelta    = rows.reduce((a, r) => a + r.rwa_delta_usd, 0);
  const totalCapitalFreed = rows.reduce((a, r) => a + r.capital_freed_usd, 0);
  const totalAnnualSaving = rows.reduce((a, r) => a + r.annual_saving_usd, 0);
  const portfolioBps     = totalNotional > 0
    ? (totalAnnualSaving / totalNotional) * 10_000
    : 0;

  const compliance_flags = [];
  if (portfolioBps > 5)  compliance_flags.push('MATERIAL_CAPITAL_SAVING');
  if (portfolioBps < 1)  compliance_flags.push('IMMATERIAL_SAVING');
  const hasSco60 = rows.some(r => r.flags.includes('BCBS_SCO60_TREATMENT_FLAGGED'));
  if (hasSco60)          compliance_flags.push('BCBS_SCO60_TREATMENT_FLAGGED');

  return {
    verdict:               portfolioBps > 5 ? 'MATERIAL' : portfolioBps > 1 ? 'MODERATE' : 'IMMATERIAL',
    total_notional_usd:    +totalNotional.toFixed(2),
    total_rwa_delta_usd:   +totalRwaDelta.toFixed(2),
    total_capital_freed:   +totalCapitalFreed.toFixed(2),
    total_annual_saving:   +totalAnnualSaving.toFixed(2),
    portfolio_bps:         +portfolioBps.toFixed(2),
    cet1_ratio:            cet1Ratio,
    cost_of_capital:       costOfCapital,
    rows,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:      meta.tool_id,
    mandate_type: meta.mandate_type,
    ...r,
    inputs: {
      position_count: (pp.positions ?? []).length,
      cet1_ratio:     pp.cet1_ratio     ?? DEFAULT_CET1,
      cost_of_capital: pp.cost_of_capital ?? DEFAULT_COC,
    },
  };
}
