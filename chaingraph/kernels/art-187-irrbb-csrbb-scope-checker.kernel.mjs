import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-187-irrbb-csrbb-scope-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_irrbb_csrbb_scope',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Credit Spread Risk in the Banking Book (CSRBB) scope identification per EBA
// Guidelines on IRRBB & CSRBB (EBA/GL/2022/14): instruments held at fair value
// whose credit-spread risk is not fully captured by credit-risk or IRRBB
// frameworks (e.g. FVOCI/AFS bond books, fair-valued loans, liquidity-buffer
// bonds) put a bank in scope of CSRBB monitoring, requiring a defined
// methodology and ICAAP inclusion. No EU-wide materiality threshold is
// prescribed -- proportionality is a competent-authority/institution judgment.
// Second node of irrbb-measurement-and-disclosure chain. NaN-safe. Zero
// network, zero PII.
export function compute(pp) {
  const { instruments = {}, governance = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const fvoci_afs_bonds = g(instruments.fvoci_afs_bonds);
  const fair_value_loans = g(instruments.fair_value_loans);
  const liquidity_buffer_bonds = g(instruments.liquidity_buffer_bonds);
  const in_scope_amount = fvoci_afs_bonds + fair_value_loans + liquidity_buffer_bonds;
  const in_scope = in_scope_amount > 0;

  const csrbb_methodology_defined = governance.csrbb_methodology_defined === true;
  const csrbb_included_in_icaap = governance.csrbb_included_in_icaap === true;

  const gaps = [];
  if (in_scope && !csrbb_methodology_defined) gaps.push('csrbb_methodology_defined');
  if (in_scope && !csrbb_included_in_icaap) gaps.push('csrbb_included_in_icaap');

  const csrbb_conformant = in_scope ? gaps.length === 0 : true;

  const compliance_flags = { IRRBB_CSRBB_SCOPE_CHECKED: true };
  if (in_scope) compliance_flags.CSRBB_IN_SCOPE = true;
  if (csrbb_conformant) compliance_flags.CSRBB_CONFORMANT = true;
  else compliance_flags.CSRBB_GAP = true;

  return {
    output_payload: {
      in_scope,
      in_scope_amount,
      csrbb_methodology_defined,
      csrbb_included_in_icaap,
      csrbb_conformant,
      gaps,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
