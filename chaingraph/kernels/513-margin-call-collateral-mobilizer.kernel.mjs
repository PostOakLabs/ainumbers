import { executionHash } from './_hash.mjs';

const TOOL_ID = '513-margin-call-collateral-mobilizer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'mobilize_margin_collateral',
  mandate_type: 'collateral_mandate',
  gpu: false,
};

const DERIV_TYPES = ['interest_rate_swap','cds','fx_forward','equity_option','commodity_swap','swaption'];
const SFT_TYPES   = ['repo','reverse_repo','securities_lending','buy_sell_back'];

const DERIV_HAIRCUTS = {
  cash_usd: 0,
  cash_eur: 0,
  ust: 0.02,
  gilt: 0.02,
  ig_corp: 0.08,
  equity: 0.15,
};

const SFT_HAIRCUTS = {
  cash_usd: 0,
  cash_eur: 0,
  ust: 0.005,
  gilt: 0.005,
  ig_corp: 0.02,
  equity: null,
};

export function compute(pp) {
  const {
    instrument_type,
    portfolio_mtm = 0,
    aana = 0,
    ccp_cleared = false,
    mta = 500000,
    collateral_rows = [],
    on_chain = false,
  } = pp;

  const isDeriv = DERIV_TYPES.includes(instrument_type);
  const isSft   = SFT_TYPES.includes(instrument_type);

  // Margin calls
  let imCall = 0;
  let vmCall = 0;

  if (!ccp_cleared) {
    if (isDeriv) {
      imCall = Math.abs(portfolio_mtm);
      vmCall = Math.abs(portfolio_mtm);
    } else if (isSft) {
      imCall = Math.abs(portfolio_mtm) * 1.02;
      vmCall = Math.abs(portfolio_mtm) * 0.002;
    }
  }

  // Per-row collateral
  const collateral_detail = collateral_rows.map(row => {
    const { asset_type, notional, already_posted } = row;
    const ineligible = isSft && asset_type === 'equity';
    let hc;
    if (isDeriv) {
      hc = DERIV_HAIRCUTS[asset_type] ?? 0;
    } else {
      hc = SFT_HAIRCUTS[asset_type] ?? 0;
    }
    const eligible_value = ineligible ? 0 : notional * (1 - (hc ?? 0));
    const mobilizable = !already_posted && eligible_value > 0;
    return { asset_type, notional, already_posted, ineligible, hc, eligible_value: +eligible_value.toFixed(2), mobilizable };
  });

  const totalMobilizable = collateral_detail
    .filter(r => r.mobilizable)
    .reduce((s, r) => s + r.eligible_value, 0);

  const totalRequired = ccp_cleared ? 0 : (isDeriv ? imCall + vmCall : imCall);
  const gap = totalRequired - totalMobilizable;

  // UMR flags
  const umrPhaseInapplicable = aana < 8_000_000_000;
  const imBelowThreshold = imCall <= 50_000_000;
  const mtaDeviation = mta !== 500_000;

  const compliance_flags = {
    DERIV_UMR_FRAMEWORK:        { active: isDeriv && !ccp_cleared },
    SFT_GMRA_FRAMEWORK:         { active: isSft },
    CCP_CLEARED_ZERO_MARGIN:    { active: ccp_cleared },
    UMR_PHASE_INAPPLICABLE:     { active: umrPhaseInapplicable },
    IM_BELOW_THRESHOLD_NOTE:    { active: imBelowThreshold },
    MTA_DEVIATION_NOTE:         { active: mtaDeviation },
    CANTON_ON_CHAIN_MOBILIZATION:{ active: !!on_chain },
    MARGIN_MOBILIZATION_ASSESSED:{ active: true },
  };

  const output_payload = {
    im_call: +imCall.toFixed(2),
    vm_call: +vmCall.toFixed(2),
    total_required: +totalRequired.toFixed(2),
    total_mobilizable: +totalMobilizable.toFixed(2),
    gap: +gap.toFixed(2),
    shortfall: gap > 0,
    collateral_detail,
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
