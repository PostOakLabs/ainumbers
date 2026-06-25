import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-113-saleable-returns-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_saleable_return',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { returned_sgtin, original_sgtin, returned_lot, original_lot,
          original_txn_hash, seller_authorized, within_resale_window } = pp;
  const id_match = returned_sgtin === original_sgtin;
  const lot_match = returned_lot === original_lot;
  const txn_anchored = typeof original_txn_hash === 'string' && original_txn_hash.startsWith('sha256:');
  const match = id_match && lot_match && txn_anchored;
  let verdict, reason;
  if (!seller_authorized) { verdict = 'REFUSE'; reason = 'UNAUTHORIZED_TRADING_PARTNER'; }
  else if (!match)        { verdict = 'REFUSE'; reason = 'NO_MATCH_TO_ORIGINAL_TRANSACTION'; }
  else if (within_resale_window === false) { verdict = 'REFUSE'; reason = 'OUTSIDE_RESALE_WINDOW'; }
  else { verdict = 'ACCEPT'; reason = 'VERIFIED'; }
  const compliance_flags = { SALEABLE_RETURN_ASSESSED: true };
  compliance_flags[verdict === 'ACCEPT' ? 'SALEABLE_RETURN_VERIFIED' : 'SALEABLE_RETURN_REFUSED'] = true;
  return { output_payload: { match, verdict, reason, id_match, lot_match, txn_anchored }, compliance_flags };
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
