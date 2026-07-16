/**
 * art-318-rhc-regime-mapper.kernel.mjs
 * Financial-Instrument Regime Mapper — Robinhood Chain stock tokens.
 * Maps the regime implied by pasted instrument-characterization facts. Never asserts a legal
 * conclusion; names the assumption. See RHC-WAVE-BUILD-SPEC.md §RHC-2 / §Endnote E6.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-318-rhc-regime-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'map_robinhood_chain_regime',
  mandate_type: 'crypto_regulatory_mandate',
  gpu:          false,
};

export function compute(pp) {
  const {
    issuer_entity = null,
    instrument_type = null,       // 'tokenized_debt_security' | 'tokenized_equity' | 'utility_token' | 'e_money_token' | 'asset_referenced_token'
    wrapper = null,                // 'SPV' | 'direct'
    holder_of_record = null,       // 'SPV' | 'token_holder'
    voting_rights = null,          // boolean
    target_jurisdictions = [],     // e.g. ['EU','US']
  } = pp;

  const assumptions = [];
  const regime = [];

  // MiCA carve-out — Art. 2(4)(a): financial instruments are out of scope of MiCA.
  const mica_carveout_applies = instrument_type === 'tokenized_debt_security' && wrapper === 'SPV';
  if (mica_carveout_applies) {
    regime.push({ framework: 'MiCA', applicable: false, basis: 'Art. 2(4)(a) financial-instrument carve-out', assumption: 'instrument characterized as a tokenized debt security wrapped via an SPV' });
    assumptions.push('MiCA_inapplicable_given_debt_security_characterization');
  } else {
    regime.push({ framework: 'MiCA', applicable: null, basis: 'characterization does not match the debt-security/SPV carve-out pattern this mapper checks for', assumption: 'not evaluated — insufficient characterization match' });
  }

  // MiFID II transferable-security classification.
  const mifid2_transferable_security = instrument_type === 'tokenized_debt_security';
  regime.push({ framework: 'MiFID II', applicable: mifid2_transferable_security, basis: mifid2_transferable_security ? 'debt security issued by a regulated entity implies transferable-security classification' : 'characterization does not imply a transferable security', assumption: 'characterization as given, not independently verified' });

  // Prospectus exposure.
  const targetsEU = target_jurisdictions.includes('EU');
  const prospectus_exposure = mifid2_transferable_security && targetsEU;
  if (prospectus_exposure) assumptions.push('prospectus_exposure_flagged_for_EU_public_offer');

  // No-US-persons gate.
  const targetsUS = target_jurisdictions.includes('US');
  const us_persons_gate_violated = targetsUS === true;
  if (us_persons_gate_violated) assumptions.push('target_jurisdictions_include_US_violating_no_US_persons_facts');

  // Voting-rights disclosure — the SPV is holder of record; token holders typically have none.
  const disclose_no_voting_rights = holder_of_record === 'SPV' && voting_rights !== true;
  if (disclose_no_voting_rights) assumptions.push('SPV_is_holder_of_record_token_holders_have_no_voting_rights');

  const output_payload = {
    regime_tree: regime,
    mica_carveout_applies,
    mifid2_transferable_security,
    prospectus_exposure,
    us_persons_gate_violated,
    disclose_no_voting_rights,
    issuer_entity,
    assumptions,
    note: 'This node maps the regime implied by the pasted characterization; it does not render a legal conclusion.',
  };

  const compliance_flags = [];
  if (mica_carveout_applies) compliance_flags.push('MICA_CARVEOUT_APPLIED');
  if (us_persons_gate_violated) compliance_flags.push('US_PERSONS_GATE_VIOLATION');
  if (prospectus_exposure) compliance_flags.push('PROSPECTUS_EXPOSURE_FLAGGED');

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
