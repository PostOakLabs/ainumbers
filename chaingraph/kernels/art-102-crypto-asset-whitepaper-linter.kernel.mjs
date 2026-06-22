import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-102-crypto-asset-whitepaper-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'lint_crypto_asset_whitepaper',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const REQUIRED_SECTIONS = [
  'identity-of-offeror',
  'description-of-project',
  'description-of-crypto-asset',
  'rights-obligations',
  'technology',
  'risks',
  'principal-adverse-impacts',
  'conflicts-of-interest',
  'fees-and-charges',
  'regulatory-status',
];

export function compute(pp) {
  const { inputs = {} } = pp;
  const {
    annex_i_sections = [],
    format = 'other',
    taxonomy_version = '',
    crypto_asset_type = 'other-than-art-emt',
  } = inputs;

  // Build lookup of provided sections
  const sectionMap = {};
  for (const entry of annex_i_sections) {
    if (entry && entry.section) {
      sectionMap[entry.section] = entry.status;
    }
  }

  // Find gaps: required sections that are not 'complete'
  const annex_i_gaps = REQUIRED_SECTIONS.filter((sec) => {
    const status = sectionMap[sec];
    return !status || status !== 'complete';
  });

  const ixbrl_valid = format === 'ixbrl';
  const taxonomy_conformant = !!(taxonomy_version && taxonomy_version.includes('ESMA-MiCA'));
  const sections_checked = annex_i_sections.length;
  const gap_count = annex_i_gaps.length;
  const no_sections = sections_checked === 0;

  // Conformance grade
  let conformance_grade;
  if (!no_sections && gap_count === 0 && ixbrl_valid && taxonomy_conformant) {
    conformance_grade = 'A';
  } else if (!no_sections && gap_count === 0 && ixbrl_valid && !taxonomy_conformant) {
    conformance_grade = 'B';
  } else if (!no_sections && gap_count === 0 && !ixbrl_valid) {
    conformance_grade = 'B';
  } else if (!no_sections && gap_count >= 1 && gap_count <= 2) {
    conformance_grade = 'C';
  } else if (!no_sections && gap_count >= 3 && gap_count <= 4) {
    conformance_grade = 'D';
  } else {
    conformance_grade = 'F';
  }

  // Compliance flags
  const compliance_flags = [];
  if (annex_i_gaps.length > 0) compliance_flags.push('ANNEX_I_INCOMPLETE');
  if (!ixbrl_valid) compliance_flags.push('IXBRL_INVALID');
  if (!taxonomy_conformant) compliance_flags.push('TAXONOMY_NONCONFORMANT');

  const output_payload = {
    conformance_grade,
    sections_checked,
    annex_i_gaps,
    ixbrl_valid,
    taxonomy_conformant,
    taxonomy_note:
      'ITS (EU) 2024/2984 mandates iXBRL format + ESMA MiCA taxonomy. Verify current taxonomy version at ESMA portal.',
    reference_version: '2026-06',
    note: 'Art 6/8 + Annex I MiCA Reg. (EU) 2023/1114. ITS (EU) 2024/2984. Decision-support draft.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(
  pp,
  { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}
) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
