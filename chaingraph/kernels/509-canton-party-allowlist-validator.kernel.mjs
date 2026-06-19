export const meta = {
  tool_id: '509-canton-party-allowlist-validator',
  mcp_name: 'validate_canton_party_allowlist',
  mandate_type: 'compliance_mandate',
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

  return {
    portfolio_verdict,
    party_count: parties.length,
    parties: partyResults,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    ...result,
  };
}
