import { executionHash } from './_hash.mjs';

const TOOL_ID = '509-canton-party-allowlist-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_canton_party_allowlist',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

function screenParty(party) {
  const { party_name, lei, daml_party_id, daml_party_id_known, fatf_status, pep, adverse_media, canton_access } = party;

  let decision = 'APPROVED';
  const flags = [];

  // Priority: FATF black list
  if (fatf_status === 'black_list') {
    decision = 'REJECTED';
    flags.push('FATF_BLACK_LIST_MATCH');
  } else if (fatf_status === 'grey_list') {
    decision = 'APPROVED_WITH_CONDITIONS';
    flags.push('FATF_GREY_LIST_MATCH', 'ENHANCED_DUE_DILIGENCE_REQUIRED');
  }

  // PEP — apply if not REJECTED
  if (pep && decision !== 'REJECTED') {
    decision = 'APPROVED_WITH_CONDITIONS';
    if (!flags.includes('PEP_IDENTIFIED')) flags.push('PEP_IDENTIFIED');
    if (!flags.includes('ENHANCED_DUE_DILIGENCE_REQUIRED')) flags.push('ENHANCED_DUE_DILIGENCE_REQUIRED');
  }

  // Adverse media — apply if not already worse
  if (adverse_media && decision !== 'REJECTED') {
    decision = 'APPROVED_WITH_CONDITIONS';
    if (!flags.includes('ADVERSE_MEDIA_FLAG')) flags.push('ADVERSE_MEDIA_FLAG');
  }

  // Additional flags (do not change decision)
  if (!lei) flags.push('TRAVEL_RULE_LEI_MISSING');
  if (!daml_party_id_known) flags.push('CANTON_PARTY_ID_MISSING');
  if (canton_access === 'unknown') flags.push('CANTON_ACCESS_UNVERIFIED');

  return { party_name, decision, flags };
}

export function compute(pp) {
  const { parties = [] } = pp;

  const partyResults = parties.map(screenParty);

  const anyRejected = partyResults.some(p => p.decision === 'REJECTED');
  const anyConditional = partyResults.some(p => p.decision === 'APPROVED_WITH_CONDITIONS');

  let portfolio_verdict;
  if (anyRejected) {
    portfolio_verdict = 'ONE_OR_MORE_REJECTED';
  } else if (!anyConditional) {
    portfolio_verdict = 'ALL_APPROVED';
  } else {
    portfolio_verdict = 'CONDITIONAL';
  }

  // Union of per-party flags
  const allFlags = new Set(partyResults.flatMap(p => p.flags));

  const FLAG_KEYS = [
    'FATF_BLACK_LIST_MATCH', 'FATF_GREY_LIST_MATCH', 'TRAVEL_RULE_LEI_MISSING',
    'PEP_IDENTIFIED', 'ADVERSE_MEDIA_FLAG', 'ENHANCED_DUE_DILIGENCE_REQUIRED',
    'CANTON_PARTY_ID_MISSING', 'CANTON_ACCESS_UNVERIFIED',
  ];

  const compliance_flags = {
    PARTY_ALLOWLIST_VALIDATED: true,
    ALL_PARTIES_APPROVED: portfolio_verdict === 'ALL_APPROVED',
    CONDITIONAL_APPROVAL: portfolio_verdict === 'CONDITIONAL',
    ONE_OR_MORE_REJECTED: portfolio_verdict === 'ONE_OR_MORE_REJECTED',
  };

  for (const k of FLAG_KEYS) {
    compliance_flags[k] = allFlags.has(k);
  }

  const output_payload = { portfolio_verdict, party_count: parties.length, parties: partyResults };
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
