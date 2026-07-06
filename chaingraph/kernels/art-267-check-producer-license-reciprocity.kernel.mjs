import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-267-check-producer-license-reciprocity';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// NAIC reciprocity: most states have full reciprocity for NAIC-standard LOAs.
// Non-standard / limited-reciprocity states as of 2024 edition.
// Source: NAIC State-Based Systems Producer Licensing Reciprocity Matrix 2024; NIPR reciprocity data.
// NOTE: This kernel uses structural LOA enums ONLY. Never real NPN/PDB/SSN.
const NON_STANDARD_STATES = new Set([
  'CA', // California: no non-resident reciprocity (individual license required)
  'FL', // Florida: limited reciprocity (criminal background check required)
  'NJ', // New Jersey: no non-resident life reciprocity for some LOAs
  'NY', // New York: no reciprocity (independent licensing required)
  'HI', // Hawaii: limited non-resident licensing
  'MN', // Minnesota: requires state exam for non-residents
  'WI', // Wisconsin: limited reciprocity for P&C
]);

// Standard NAIC LOA codes
const VALID_LOA_CODES = new Set([
  'L', 'H', 'A', 'LTC', 'VI', 'CV', 'P', 'C', 'HO', 'CA', 'LA', 'MV', 'WC',
  'SP', 'PH', 'FM', 'OR', 'SB', 'MR', 'PL', 'LH', 'PC', 'VL',
]);

export function compute(policy_parameters) {
  const {
    resident_state = '',
    loa_codes = [],
    target_states = [],
  } = policy_parameters;

  const resident_non_standard = NON_STANDARD_STATES.has(resident_state.toUpperCase());
  const invalid_loa_codes = loa_codes.filter(c => !VALID_LOA_CODES.has(c.toUpperCase()));

  const coverage_by_target = [];
  let all_reciprocal = true;

  for (const ts of target_states) {
    const tsUpper = ts.toUpperCase();
    const is_non_standard = NON_STANDARD_STATES.has(tsUpper);
    const reciprocal = !is_non_standard && !resident_non_standard;

    // LOA gap check: if target is non-standard, all LOAs may need independent filing
    const loa_gaps = is_non_standard
      ? loa_codes.map(c => ({ loa: c, note: `${tsUpper} requires independent filing or exam; verify with NIPR` }))
      : [];

    const flags = [];
    if (is_non_standard) flags.push(`${tsUpper}_NON_STANDARD_STATE`);
    if (resident_non_standard) flags.push(`RESIDENT_${resident_state.toUpperCase()}_NON_STANDARD`);
    if (!reciprocal) all_reciprocal = false;

    coverage_by_target.push({
      target_state: tsUpper,
      is_non_standard,
      reciprocal,
      loa_gaps,
      flags,
      note: reciprocal
        ? `Standard NAIC reciprocity applies; non-resident license available without exam`
        : `Manual filing required; verify current NAIC reciprocity matrix with NIPR before filing`,
    });
  }

  return {
    resident_state: resident_state.toUpperCase(),
    loa_codes,
    invalid_loa_codes,
    target_state_count: target_states.length,
    non_standard_states: [...NON_STANDARD_STATES].filter(s => target_states.map(t => t.toUpperCase()).includes(s)),
    all_reciprocal,
    coverage_by_target,
    table_version: 'NAIC-PRODUCER-RECIPROCITY-MATRIX-2024',
    table_source: 'NAIC State-Based Systems Producer Licensing Reciprocity Matrix 2024; NIPR Reciprocity Data 2024. Non-standard states: CA (no non-resident reciprocity), FL (background check required), NJ (limited life LOA), NY (independent license required), HI (limited), MN (state exam required), WI (limited P&C). Verify current matrix with NIPR before any license filing.',
    regulatory_basis: 'NAIC Producer Licensing Model Act (MDL-218): reciprocal licensing for non-resident producers if resident state has substantially similar licensing requirements. 50 USC producer licensing: state-specific. NIPR Gateway = authoritative current data. ZERO PII: state/LOA enum inputs only. Never real NPN, SSN, or PDB data.',
    pii_note: 'ZERO PII: state codes and LOA enum codes only. No NPN, SSN, PDB, producer name, or personal data enters this kernel. Use NIPR for live NPN verification.',
    not_legal_advice: 'Not legal advice. Producer licensing requirements change; verify all reciprocity determinations with NIPR and state insurance departments before submitting non-resident license applications.',
  };
}

export async function buildArtifact(policy_parameters, opts = {}) {
  const output_payload = compute(policy_parameters);
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    chaingraph_version: '0.4.0',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    policy_parameters,
    output_payload,
    execution_hash,
  };
}
