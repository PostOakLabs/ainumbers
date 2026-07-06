import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-272-restaking-risk';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mandate_type: 'analytics_mandate', gpu: false,
};

// Restaking delegation and slashing-waterfall risk model.
// Models EigenLayer + Symbiotic: operator rewards, AVS yield, slashing exposure through
// first-loss buffer-tranche generalization, and slashing-insurance economics.
// Source: EigenLayer Restaking documentation 2024; Symbiotic protocol specification 2024;
// Ethos/RSTK insurance premium benchmarks 2024.
// ZERO PII: staking amounts and protocol parameters only. No wallet address or personal data.

// Protocol defaults
const PROTOCOL_DEFAULTS = {
  eigenlayer: {
    protocol_note: 'EigenLayer: Ethereum restaking. ETH or LST delegated to operators who opt into AVS (Actively Validated Services). Slashing conditions defined per-AVS; operator+delegator both exposed. Three-party model: restaker, operator, AVS.',
    base_staking_apy_pct: 3.5,    // Lido stETH base APY approximate 2024
    operator_fee_pct: 10,
    avs_reward_apy_pct: 2.5,      // Additional AVS reward (variable; depends on AVS mix)
    slashing_risk_pct: 0.5,       // Annual probability of slashing event (low historically)
    slash_magnitude_pct: 1.0,     // Typical slash magnitude (severe = up to 100%)
    first_loss_buffer_pct: 100,   // EigenLayer: no protocol first-loss buffer (operator stake absorbs first)
    first_loss_tranche_pct: 0,    // Delegators exposed immediately after operator stake exhausted
  },
  symbiotic: {
    protocol_note: 'Symbiotic: three-way opt-in restaking (network, vault, operator all choose each other). Burner routers + resolver multisigs mediate slashing. Vaults can allocate stake across multiple networks with independent slashing domains.',
    base_staking_apy_pct: 3.5,
    operator_fee_pct: 10,
    avs_reward_apy_pct: 3.0,
    slashing_risk_pct: 0.3,
    slash_magnitude_pct: 0.5,
    first_loss_buffer_pct: 20,    // Vault can hold a resolver buffer (configurable, typically 5-20%)
    first_loss_tranche_pct: 30,   // Buffer absorbs ~30% of slash before delegator tranche
  },
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const protocol = (pp.protocol || 'eigenlayer').toLowerCase();
  const def = PROTOCOL_DEFAULTS[protocol] || PROTOCOL_DEFAULTS.eigenlayer;

  const staked_eth          = Math.max(0, safeNum(pp.staked_eth, 32));
  const eth_price_usd       = Math.max(0.01, safeNum(pp.eth_price_usd, 3500));
  const base_apy_pct        = Math.max(0, safeNum(pp.base_staking_apy_pct, def.base_staking_apy_pct));
  const operator_fee_pct    = Math.max(0, Math.min(100, safeNum(pp.operator_fee_pct, def.operator_fee_pct)));
  const avs_reward_apy_pct  = Math.max(0, safeNum(pp.avs_reward_apy_pct, def.avs_reward_apy_pct));
  const slashing_risk_pct   = Math.max(0, Math.min(100, safeNum(pp.slashing_risk_pct, def.slashing_risk_pct)));
  const slash_magnitude_pct = Math.max(0, Math.min(100, safeNum(pp.slash_magnitude_pct, def.slash_magnitude_pct)));
  // first_loss_tranche_pct: what fraction (%) of the slash the first-loss buffer absorbs
  const first_loss_tranche_pct = Math.max(0, Math.min(100, safeNum(pp.first_loss_tranche_pct, def.first_loss_tranche_pct)));
  const insurance_premium_pct  = Math.max(0, Math.min(50, safeNum(pp.insurance_premium_pct_of_rewards, 0.5)));
  const insurance_enabled      = pp.insurance_enabled !== false;

  const staked_usd = round2(staked_eth * eth_price_usd);

  // --- Reward Model ---
  const gross_apy_pct = round4(base_apy_pct + avs_reward_apy_pct);
  // Operator takes operator_fee_pct of rewards (applied to gross rewards, not base)
  const operator_cut_pct = round4(gross_apy_pct * operator_fee_pct / 100);
  const net_apy_pct = round4(gross_apy_pct - operator_cut_pct);

  const gross_usd_per_year = round2(staked_usd * gross_apy_pct / 100);
  const operator_fee_usd_per_year = round2(staked_usd * operator_cut_pct / 100);
  const net_usd_per_year = round2(staked_usd * net_apy_pct / 100);

  // --- Slashing Waterfall ---
  // Maximum slash exposure (if slashing occurs)
  const max_slash_usd = round2(staked_usd * slash_magnitude_pct / 100);
  // First-loss buffer absorbs first_loss_tranche_pct of the slash
  const buffer_absorbs_usd = round2(max_slash_usd * first_loss_tranche_pct / 100);
  // Delegator net exposure after buffer
  const delegator_net_slash_usd = round2(max_slash_usd - buffer_absorbs_usd);
  const delegator_net_slash_eth = round6(delegator_net_slash_usd / Math.max(0.01, eth_price_usd));
  // Expected annual slashing cost (probability-weighted)
  const expected_annual_slash_usd = round2(delegator_net_slash_usd * slashing_risk_pct / 100);

  // --- Insurance Economics ---
  const insurance_premium_usd_per_year = round2(net_usd_per_year * insurance_premium_pct / 100);
  // Risk/reward ratio: annual expected slash / annual insurance premium
  const risk_reward_ratio = insurance_premium_usd_per_year > 0
    ? round4(expected_annual_slash_usd / insurance_premium_usd_per_year)
    : null;
  const insurance_makes_sense = risk_reward_ratio !== null ? risk_reward_ratio > 1 : null;

  // Net APR after expected slashing risk (probabilistic) and optional insurance
  let net_usd_per_year_risk_adjusted = round2(net_usd_per_year - expected_annual_slash_usd);
  let net_apy_risk_adjusted_pct = round4(staked_usd > 0 ? net_usd_per_year_risk_adjusted / staked_usd * 100 : 0);

  let net_with_insurance_usd_per_year = null;
  let net_with_insurance_apy_pct = null;
  if (insurance_enabled) {
    net_with_insurance_usd_per_year = round2(net_usd_per_year_risk_adjusted - insurance_premium_usd_per_year);
    net_with_insurance_apy_pct = round4(staked_usd > 0 ? net_with_insurance_usd_per_year / staked_usd * 100 : 0);
  }

  const compliance_flags = [];
  if (slashing_risk_pct > 2)       compliance_flags.push('HIGH_SLASHING_RISK');
  if (slash_magnitude_pct > 10)    compliance_flags.push('HIGH_SLASH_MAGNITUDE');
  if (net_apy_risk_adjusted_pct < 0) compliance_flags.push('NEGATIVE_RISK_ADJUSTED_YIELD');
  if (first_loss_tranche_pct < 10) compliance_flags.push('MINIMAL_FIRST_LOSS_BUFFER');
  if (operator_fee_pct > 20)       compliance_flags.push('HIGH_OPERATOR_FEE');

  const output_payload = {
    protocol,
    staked_eth: round6(staked_eth),
    staked_usd,
    eth_price_usd: round2(eth_price_usd),
    // Rewards
    gross_apy_pct,
    operator_cut_pct,
    net_apy_pct,
    gross_usd_per_year,
    operator_fee_usd_per_year,
    net_usd_per_year,
    // Slashing waterfall
    slash_magnitude_pct: round4(slash_magnitude_pct),
    max_slash_usd,
    first_loss_tranche_pct: round4(first_loss_tranche_pct),
    buffer_absorbs_usd,
    delegator_net_slash_usd,
    delegator_net_slash_eth,
    slashing_risk_pct: round4(slashing_risk_pct),
    expected_annual_slash_usd,
    net_usd_per_year_risk_adjusted,
    net_apy_risk_adjusted_pct,
    // Insurance
    insurance_enabled,
    insurance_premium_pct_of_rewards: round4(insurance_premium_pct),
    insurance_premium_usd_per_year,
    risk_reward_ratio,
    insurance_makes_sense,
    net_with_insurance_usd_per_year,
    net_with_insurance_apy_pct,
    protocol_note: def.protocol_note,
    table_version: 'RESTAKING-PROTOCOLS-EIGENLAYER-SYMBIOTIC-2024',
    table_source: 'EigenLayer restaking documentation 2024 (operator/AVS model, slashing conditions); Symbiotic protocol specification 2024 (three-way opt-in, burner routers); slashing-insurance premium benchmarks ~0.5% of rewards per market survey 2024.',
    regulatory_basis: 'Restaking is an unregulated activity in most jurisdictions. Slashing conditions vary by AVS/network and operator behavior. This model uses protocol-level parameters; actual slashing probability depends on operator diligence and AVS code correctness.',
    pii_note: 'ZERO PII: staking amounts and protocol parameters only. No wallet address, staking key, operator identity, or personal data enters this kernel.',
    not_financial_advice: 'Not financial or investment advice. Restaking carries smart contract risk, operator risk, slashing risk, and liquidity risk. Verify current operator and AVS conditions before delegating.',
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
