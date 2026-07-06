import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-271-defi-lending-health';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mandate_type: 'analytics_mandate', gpu: false,
};

// Per-protocol liquidation defaults (Aave-style LTV basis unless noted).
// Sources: Aave v3 Risk Parameters 2024; Morpho Blue vault parameters; Fluid documentation;
// Sky (MakerDAO v2) Liquidation Ratio table; Liquity v2 protocol specification.
// ZERO PII: position amounts and protocol parameters only. No wallet address or personal data.
const PROTOCOL_DEFAULTS = {
  aave: {
    liq_threshold_pct: 83,
    liq_bonus_pct: 5,
    close_factor_pct: 50,
    mechanism: 'fixed_bonus',
    mechanism_note: 'Aave v3 fixed 5% liquidation bonus; close factor 50% (up to 100% when HF < 0.95). Any address may trigger liquidation. ETH/USDC main market default thresholds.',
  },
  morpho: {
    liq_threshold_pct: 86,
    liq_bonus_pct: 3.5,
    close_factor_pct: 100,
    mechanism: 'mev_auction',
    mechanism_note: 'Morpho Blue: permissionless MEV-auction liquidation. Bonus is market-determined per-vault curator (0-5%); full position may be liquidated. More capital-efficient; higher liquidation severity than Aave.',
  },
  fluid: {
    liq_threshold_pct: 90,
    liq_bonus_pct: 2,
    close_factor_pct: 100,
    mechanism: 'continuous',
    mechanism_note: 'Fluid: continuous liquidation curve. As health drops below threshold, liquidatable amount increases continuously rather than discretely. Reduces cascades; partial liquidation always available.',
  },
  sky: {
    // Sky (MakerDAO v2): liquidation_ratio expressed as min collateral ratio %
    // liq_threshold_pct here = minimum collateral ratio (e.g. 170 means 170% CR = ~59% LTV)
    liq_threshold_pct: 170,
    liq_bonus_pct: 13,
    close_factor_pct: 100,
    mechanism: 'dutch_auction',
    mechanism_note: 'Sky (MakerDAO v2): Clipper Dutch-auction. Price starts at collateral_value * multiplier and decays over time. Liquidation Ratio = minimum collateral/debt ratio. DAI/USDS debt; WETH/stETH collateral typical.',
    collateral_ratio_mode: true,
  },
  liquity_v2: {
    // Liquity v2: MCR = 110%; individual CR < MCR triggers liquidation
    liq_threshold_pct: 110,
    liq_bonus_pct: 10,
    close_factor_pct: 100,
    mechanism: 'dutch_auction',
    mechanism_note: 'Liquity v2: Dutch-auction liquidation. Minimum Collateral Ratio (MCR) 110%. Stability Pool absorbs BOLD and earns collateral at discount. Recovery mode tightens to 150% CR.',
    collateral_ratio_mode: true,
  },
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const protocol = (pp.protocol || 'aave').toLowerCase();
  const def = PROTOCOL_DEFAULTS[protocol] || PROTOCOL_DEFAULTS.aave;
  const is_cr_mode = !!def.collateral_ratio_mode;

  const collateral_value_usd  = Math.max(0, safeNum(pp.collateral_value_usd, 10000));
  const debt_value_usd        = Math.max(0, safeNum(pp.debt_value_usd, 5000));
  const collateral_price_usd  = Math.max(0.000001, safeNum(pp.collateral_price_usd, 2000));
  const liq_threshold_pct     = Math.max(1, Math.min(500, safeNum(pp.liquidation_threshold_pct, def.liq_threshold_pct)));
  const liq_bonus_pct         = Math.max(0, safeNum(pp.liquidation_bonus_pct, def.liq_bonus_pct));
  // collateral_amount used for liquidation price calculation
  const collateral_amount     = Math.max(0, safeNum(pp.collateral_amount, collateral_value_usd / Math.max(0.000001, collateral_price_usd)));

  const compliance_flags = [];

  // Health factor computation differs by mode:
  //   Aave/Morpho/Fluid (LTV mode): HF = collateral_value * (liq_threshold/100) / debt
  //   Sky/Liquity (CR mode): HF = (collateral_value/debt) / (liq_threshold/100)
  let health_factor;
  let current_ltv_pct;
  if (debt_value_usd <= 0) {
    health_factor = 9999;
    current_ltv_pct = 0;
  } else if (is_cr_mode) {
    const collateral_ratio_pct = collateral_value_usd / debt_value_usd * 100;
    health_factor = round6(collateral_ratio_pct / liq_threshold_pct);
    current_ltv_pct = collateral_value_usd > 0 ? round4(debt_value_usd / collateral_value_usd * 100) : 0;
  } else {
    health_factor = round6(collateral_value_usd * (liq_threshold_pct / 100) / debt_value_usd);
    current_ltv_pct = collateral_value_usd > 0 ? round4(debt_value_usd / collateral_value_usd * 100) : 0;
  }

  let health_status;
  if (health_factor >= 2.0)       health_status = 'SAFE';
  else if (health_factor >= 1.25) health_status = 'WATCH';
  else if (health_factor >= 1.0)  health_status = 'WARNING';
  else                            health_status = 'LIQUIDATABLE';

  // Liquidation price: price at which HF reaches 1.0 exactly
  let liquidation_price_usd = null;
  if (collateral_amount > 0 && debt_value_usd > 0) {
    if (is_cr_mode) {
      // collateral * price = debt * (liq_threshold/100) → price = debt * (liq/100) / collateral
      liquidation_price_usd = round6(debt_value_usd * (liq_threshold_pct / 100) / collateral_amount);
    } else {
      // collateral_amount * price * (liq_threshold/100) = debt → price = debt / (collateral_amount * liq/100)
      liquidation_price_usd = round6(debt_value_usd / (collateral_amount * liq_threshold_pct / 100));
    }
  }

  // Distance to liquidation as % of current price
  let distance_to_liq_pct = null;
  if (liquidation_price_usd !== null && collateral_price_usd > 0) {
    distance_to_liq_pct = round4((collateral_price_usd - liquidation_price_usd) / collateral_price_usd * 100);
  }

  // Borrow capacity: additional USD that can be borrowed before HF = 1
  let borrow_capacity_usd = 0;
  if (is_cr_mode) {
    // max_debt such that collateral / max_debt = liq_threshold/100 → max_debt = collateral / (liq/100)
    const max_debt = collateral_value_usd / (liq_threshold_pct / 100);
    borrow_capacity_usd = round2(Math.max(0, max_debt - debt_value_usd));
  } else {
    const max_debt = collateral_value_usd * (liq_threshold_pct / 100);
    borrow_capacity_usd = round2(Math.max(0, max_debt - debt_value_usd));
  }

  // Liquidation penalty if triggered (approx: bonus applied to debt repaid)
  const liquidation_penalty_usd = round2(debt_value_usd * liq_bonus_pct / 100);

  // Buffer to liquidation as % of health factor
  const buffer_to_liq_pct = round4(Math.max(0, (health_factor - 1.0) / Math.max(0.001, health_factor) * 100));

  if (health_factor < 1.0)        compliance_flags.push('LIQUIDATABLE');
  else if (health_factor < 1.1)   compliance_flags.push('CRITICAL_RISK');
  else if (health_factor < 1.25)  compliance_flags.push('HIGH_LIQUIDATION_RISK');
  else if (health_factor < 1.5)   compliance_flags.push('ELEVATED_RISK');
  if (current_ltv_pct > liq_threshold_pct && !is_cr_mode) compliance_flags.push('ABOVE_LIQ_THRESHOLD');

  const output_payload = {
    protocol,
    health_factor: round6(health_factor),
    health_status,
    current_ltv_pct,
    liquidation_threshold_pct: round4(liq_threshold_pct),
    liquidation_bonus_pct: round4(liq_bonus_pct),
    liquidation_price_usd,
    distance_to_liquidation_pct: distance_to_liq_pct,
    buffer_to_liquidation_pct: buffer_to_liq_pct,
    borrow_capacity_usd,
    collateral_value_usd: round2(collateral_value_usd),
    debt_value_usd: round2(debt_value_usd),
    liquidation_penalty_usd,
    liquidation_mechanism: def.mechanism,
    liquidation_mechanism_note: def.mechanism_note,
    table_version: 'DEFI-LENDING-PROTOCOLS-2024',
    table_source: 'Aave v3 Risk Parameters 2024; Morpho Blue vault documentation; Fluid Protocol 2024; Sky (MakerDAO v2) Clipper liquidation; Liquity v2 specification. HF formula: collateral * liq_threshold / debt (Aave-style). Sky/Liquity use collateral-ratio mode. Not live oracle data.',
    regulatory_basis: 'DeFi lending is unregulated in most jurisdictions. Health factor and liquidation prices are computed from protocol parameters entered by the user; this is not a live risk monitor. Protocol parameters change via governance vote.',
    pii_note: 'ZERO PII: position amounts and protocol parameters only. No wallet address, ENS name, or personal data enters this kernel.',
    not_financial_advice: 'Not financial or investment advice. DeFi lending carries smart contract risk, oracle manipulation risk, and liquidation risk. Verify current parameters with protocol risk dashboards before taking any position.',
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
