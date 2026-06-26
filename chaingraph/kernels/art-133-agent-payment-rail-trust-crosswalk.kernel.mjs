import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-133-agent-payment-rail-trust-crosswalk';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'crosswalk_agent_payment_rail_trust',
  mandate_type: 'compliance_mandate', gpu: false,
};

export async function compute(pp) {
  const { alg, directory_published, card_present, signature_verified } = pp;
  const ed = alg === 'ed25519', dir = directory_published === true, card = card_present === true, sig = signature_verified === true;
  const rail = (reqs) => { const gaps = Object.entries(reqs).filter(([, ok]) => !ok).map(([k]) => k); return { accepted: gaps.length === 0, gaps }; };
  const rails = {
    web_bot_auth:         rail({ ed25519: ed, directory_published: dir, signature_verified: sig }),
    visa_tap:             rail({ ed25519: ed, directory_published: dir, signature_verified: sig }),
    mastercard_agent_pay: rail({ signature_verified: sig, agent_card_present: card }),
  };
  const any_accepted = Object.values(rails).some(r => r.accepted);
  const compliance_flags = { PAYMENT_RAIL_TRUST_ASSESSED: true };
  compliance_flags[any_accepted ? 'AT_LEAST_ONE_RAIL_ACCEPTS' : 'NO_RAIL_ACCEPTS'] = true;
  return { output_payload: { rails, any_accepted }, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
