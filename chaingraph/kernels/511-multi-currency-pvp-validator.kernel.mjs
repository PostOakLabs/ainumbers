/**
 * 511-multi-currency-pvp-validator.kernel.mjs
 * Multi-Currency PvP Validator — PFMI Principle 12 atomicity + Herstatt risk assessment.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      '511-multi-currency-pvp-validator',
  mcp_name:     'validate_pvp_settlement',
  mandate_type: 'settlement_mandate',
  version:      '1.0.0',
};

// FX reference rates (mid-2025 USD base)
const FX_USD = {
  USD: 1.000,
  EUR: 0.920,
  GBP: 0.790,
  JPY: 154.00,
  CHF: 0.900,
  HKD: 7.780,
  SGD: 1.340,
};

// SA-CCR FX add-on (BCBS CRE54 supervisory factor)
const SACCR_FX_ADDON = 0.04;  // 4%

// Rate plausibility tolerance
const RATE_DEVIATION_THRESHOLD = 0.20; // 20%

function fxRefRate(ccySold, ccyBought) {
  const sold   = FX_USD[ccySold.toUpperCase()];
  const bought = FX_USD[ccyBought.toUpperCase()];
  if (!sold || !bought) return null;
  return sold / bought;
}

function toUSD(amount, ccy) {
  const rate = FX_USD[(ccy || '').toUpperCase()];
  return rate ? amount / rate : amount; // approximate; USD passthrough if not found
}

export function compute(pp) {
  // pp: { legs: Array<{ ccy_sold, ccy_bought, notional, implied_rate }>,
  //       atomicity_type, finality_type, has_unwind_procedure, canton_leg }
  const legs            = Array.isArray(pp.legs) ? pp.legs.slice(0, 4) : [];
  const atomicityType   = (pp.atomicity_type   || 'sequential_pvp').toLowerCase();
  const finalityType    = (pp.finality_type     || 'irrevocable_eod').toLowerCase();
  const hasUnwind       = !!pp.has_unwind_procedure;
  const hasCantonLeg    = !!pp.canton_leg;

  const flags = [];

  // --- Process legs ---
  const legResults = legs.map(leg => {
    const ccySold   = (leg.ccy_sold   || 'USD').toUpperCase();
    const ccyBought = (leg.ccy_bought || 'EUR').toUpperCase();
    const notional  = Number(leg.notional) || 0;
    const implied   = Number(leg.implied_rate);
    const refRate   = fxRefRate(ccySold, ccyBought);

    let rateFlag = null;
    if (refRate && !isNaN(implied) && implied > 0) {
      const deviation = Math.abs(implied - refRate) / refRate;
      if (deviation > RATE_DEVIATION_THRESHOLD) {
        rateFlag = 'PVP_RATE_IMPLAUSIBLE';
        flags.push('PVP_RATE_IMPLAUSIBLE');
      }
    }

    const notionalUSD = toUSD(notional, ccySold);
    return {
      ccy_sold:     ccySold,
      ccy_bought:   ccyBought,
      notional,
      implied_rate: isNaN(implied) ? null : implied,
      ref_rate:     refRate ? +refRate.toFixed(6) : null,
      notional_usd: +notionalUSD.toFixed(2),
      rate_flag:    rateFlag,
    };
  });

  const totalNotionalUSD = legResults.reduce((a, l) => a + l.notional_usd, 0);
  const saccrFxAddon     = +(totalNotionalUSD * SACCR_FX_ADDON).toFixed(2);

  // --- Atomicity assessment ---
  let pfmiStatus;
  let herstattStatus;
  if (atomicityType === 'atomic_pvp' && hasCantonLeg) {
    pfmiStatus     = 'PFMI_P12_COMPLIANT';
    herstattStatus = 'HERSTATT_RISK_ELIMINATED';
  } else if (atomicityType === 'atomic_pvp' && !hasCantonLeg) {
    pfmiStatus     = 'CONDITIONAL';
    herstattStatus = 'HERSTATT_RISK_REDUCED';
    flags.push('ATOMIC_PVP_WITHOUT_CANTON_LEG');
  } else if (atomicityType === 'sequential_pvp') {
    pfmiStatus     = 'CONDITIONAL';
    herstattStatus = 'HERSTATT_RISK_RESIDUAL';
    flags.push('SEQUENTIAL_PVP_RESIDUAL_RISK');
  } else {
    // free_payment
    pfmiStatus     = 'NON_COMPLIANT';
    herstattStatus = 'HERSTATT_RISK_PRESENT';
    flags.push('FREE_PAYMENT_HERSTATT_RISK');
  }

  // --- Finality flags ---
  let finalityFlag = null;
  if (finalityType === 'irrevocable_realtime') {
    finalityFlag = 'FINALITY_CONFIRMED';
  } else if (finalityType === 'irrevocable_eod') {
    finalityFlag = 'FINALITY_EOD';
    flags.push('FINALITY_EOD_LAG');
  } else if (finalityType === 'provisional') {
    finalityFlag = 'FINALITY_PROVISIONAL';
    flags.push('PROVISIONAL_FINALITY_RISK');
  } else {
    flags.push('FINALITY_UNDEFINED');
  }

  if (!hasUnwind) flags.push('UNWIND_PROCEDURE_ABSENT');

  // --- Verdict ---
  let verdict;
  if (atomicityType === 'free_payment') {
    verdict = 'FAIL';
  } else if (flags.some(f => ['SEQUENTIAL_PVP_RESIDUAL_RISK','PROVISIONAL_FINALITY_RISK',
    'FINALITY_UNDEFINED','UNWIND_PROCEDURE_ABSENT','PVP_RATE_IMPLAUSIBLE',
    'ATOMIC_PVP_WITHOUT_CANTON_LEG','FINALITY_EOD_LAG'].includes(f))) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const compliance_flags = [...new Set(flags)];
  if (verdict === 'PASS')        compliance_flags.push('PFMI_P12_SATISFIED');
  if (verdict === 'FAIL')        compliance_flags.push('PFMI_P12_VIOLATED');

  return {
    verdict,
    pfmi_p12_status:      pfmiStatus,
    herstatt_risk_status: herstattStatus,
    finality_status:      finalityFlag,
    atomicity_type:       atomicityType,
    has_unwind_procedure: hasUnwind,
    has_canton_leg:       hasCantonLeg,
    total_notional_usd:   +totalNotionalUSD.toFixed(2),
    saccr_fx_addon_usd:   saccrFxAddon,
    leg_count:            legResults.length,
    legs:                 legResults,
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
      atomicity_type:       pp.atomicity_type,
      finality_type:        pp.finality_type,
      has_unwind_procedure: pp.has_unwind_procedure,
      canton_leg:           pp.canton_leg,
      leg_count:            (pp.legs ?? []).length,
    },
  };
}
