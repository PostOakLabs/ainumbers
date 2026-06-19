import { executionHash } from './_hash.mjs';

const TOOL_ID = '510-digital-asset-regulatory-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'classify_digital_asset_regulatory',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const {
    asset_type,
    issuer_jurisdiction,
    issuer_type,
    transfer_value,
    redeemable_par,
    economic_rights,
    market_cap_eur,
    on_dlt,
  } = pp;

  const classification_results = [];
  const triggeredFlags = new Set();

  // GENIUS Act
  let geniusResult;
  if (asset_type === 'cbdc') {
    geniusResult = { framework: 'GENIUS Act', applies: 'EXEMPT', flag: 'CBDC_EXEMPT_GENIUS' };
    triggeredFlags.add('CBDC_EXEMPT_GENIUS');
  } else if (asset_type === 'stablecoin_usd' && issuer_jurisdiction === 'us' && transfer_value) {
    geniusResult = { framework: 'GENIUS Act', applies: 'APPLIES', flag: 'GENIUS_ACT_APPLIES' };
    triggeredFlags.add('GENIUS_ACT_APPLIES');
  } else {
    geniusResult = { framework: 'GENIUS Act', applies: 'NOT APPLICABLE', flag: null };
  }
  classification_results.push(geniusResult);

  // MiFID II (evaluate before MiCA)
  let mifidApplies = false;
  let mifidResult;
  if (
    asset_type === 'tokenized_security' &&
    (economic_rights || issuer_type === 'investment_firm' || issuer_type === 'fund')
  ) {
    mifidApplies = true;
    mifidResult = { framework: 'MiFID II', applies: 'APPLIES', flag: 'MIFID_II_FINANCIAL_INSTRUMENT' };
    triggeredFlags.add('MIFID_II_FINANCIAL_INSTRUMENT');
  } else {
    mifidResult = { framework: 'MiFID II', applies: 'NOT APPLICABLE', flag: null };
  }
  classification_results.push(mifidResult);

  // MiCA
  let micaResult;
  if (mifidApplies) {
    micaResult = { framework: 'MiCA', applies: 'NOT APPLICABLE', flag: null };
  } else if (asset_type === 'stablecoin_eur' && issuer_jurisdiction === 'eu' && transfer_value) {
    micaResult = { framework: 'MiCA', applies: 'APPLIES', flag: 'MICA_EMT_APPLIES' };
    triggeredFlags.add('MICA_EMT_APPLIES');
  } else if (asset_type === 'deposit_token' && issuer_jurisdiction === 'eu') {
    micaResult = { framework: 'MiCA', applies: 'NOTE', flag: 'MICA_TITLE_III_NOTE' };
    triggeredFlags.add('MICA_TITLE_III_NOTE');
  } else if (asset_type === 'utility_token' && issuer_jurisdiction === 'eu') {
    micaResult = { framework: 'MiCA', applies: 'APPLIES', flag: 'MICA_TITLE_IV_APPLIES' };
    triggeredFlags.add('MICA_TITLE_IV_APPLIES');
  } else if (issuer_jurisdiction === 'eu') {
    micaResult = { framework: 'MiCA', applies: 'APPLIES', flag: 'MICA_TITLE_IV_APPLIES' };
    triggeredFlags.add('MICA_TITLE_IV_APPLIES');
  } else {
    micaResult = { framework: 'MiCA', applies: 'NOT APPLICABLE', flag: null };
  }
  classification_results.push(micaResult);

  // EU DLT Pilot Regime
  let dltResult;
  if (asset_type === 'tokenized_security' && on_dlt && issuer_jurisdiction === 'eu') {
    if (market_cap_eur !== null && market_cap_eur !== undefined) {
      if (market_cap_eur <= 500_000_000) {
        dltResult = { framework: 'EU DLT Pilot Regime', applies: 'ELIGIBLE', flag: 'DLT_PILOT_ELIGIBLE' };
        triggeredFlags.add('DLT_PILOT_ELIGIBLE');
      } else {
        dltResult = { framework: 'EU DLT Pilot Regime', applies: 'NOT ELIGIBLE', flag: 'DLT_PILOT_THRESHOLD_EXCEEDED' };
        triggeredFlags.add('DLT_PILOT_THRESHOLD_EXCEEDED');
      }
    } else {
      dltResult = { framework: 'EU DLT Pilot Regime', applies: 'UNKNOWN', flag: null };
    }
  } else {
    dltResult = { framework: 'EU DLT Pilot Regime', applies: 'N/A', flag: null };
  }
  classification_results.push(dltResult);

  // Unclear fallback
  const hasApplies = classification_results.some(r => r.applies === 'APPLIES' || r.applies === 'ELIGIBLE');
  if (!hasApplies) {
    triggeredFlags.add('REGULATORY_CLASSIFICATION_UNCLEAR');
  }

  const compliance_flags = { REGULATORY_CLASSIFICATION_ASSESSED: true };
  for (const flag of triggeredFlags) {
    compliance_flags[flag] = true;
  }

  const output_payload = { classification_results };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
