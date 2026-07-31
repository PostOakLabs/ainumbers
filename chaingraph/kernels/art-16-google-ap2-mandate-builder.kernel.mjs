/**
 * art-16-google-ap2-mandate-builder.kernel.mjs
 * Server-side port of the deterministic Google AP2 Verifiable Digital Credential (VDC)
 * skeleton builder (ORPHANNODE-ONBOARD-2). This is the EXTERNAL Google AP2 payments
 * protocol shape — distinct from the AINumbers Policy Mandate export (CONTRACT §3.1).
 * Field names are illustrative; verify against ap2-protocol.org before signing for real.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-16-google-ap2-mandate-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'draft_ap2_mandate_credential',
  mandate_type: 'payment_policy',
  gpu: false,
};

function str(v, fallback) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

export function compute(pp) {
  pp = pp || {};

  const mandate_type = pp.mandate_type === 'payment' ? 'payment' : 'checkout';
  const stage = pp.stage === 'closed' ? 'closed' : 'open';
  const agent_id = str(pp.agent_id, 'did:example:agent');
  const subject = str(pp.subject, 'did:example:subject');
  const merchant = str(pp.merchant, 'example-merchant');
  const amountRaw = str(pp.amount, '0 USD').split(/\s+/);
  const amountValue = amountRaw[0] || '0';
  const amountCurrency = (amountRaw[1] || 'USD').toUpperCase();

  const typeName = mandate_type === 'checkout' ? 'CheckoutMandate' : 'PaymentMandate';

  const credentialSubject = { id: subject, mandateType: mandate_type, stage, merchant };
  if (stage === 'closed') {
    credentialSubject.checkoutRef = `checkout:${merchant}`;
    credentialSubject.amount = { value: amountValue, currency: amountCurrency };
  } else {
    credentialSubject.constraints = mandate_type === 'payment'
      ? { maxAmount: { value: amountValue, currency: amountCurrency }, instrument: 'card' }
      : { merchantAllowList: [merchant], goal: 'user-stated purchase intent' };
  }

  const vdc = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://ap2-protocol.org/context/v1'],
    type: ['VerifiableCredential', typeName],
    issuer: agent_id,
    credentialSubject,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-2022',
      verificationMethod: `${agent_id}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: '<ILLUSTRATIVE — sign with the agent key>',
    },
  };

  const output_payload = {
    vdc,
    vdc_type: typeName,
    vdc_stage: stage,
    issuer: agent_id,
    has_proof: true,
    note: 'Illustrative Google AP2 mandate skeleton (external spec, ap2-protocol.org) — distinct from the AINumbers Policy Mandate. Field names illustrative; sign with the agent key and verify against the live spec before real use.',
  };

  const compliance_flags = ['AP2_SKELETON_BUILT'];
  compliance_flags.push(mandate_type === 'payment' ? 'PAYMENT_MANDATE' : 'CHECKOUT_MANDATE');
  compliance_flags.push(stage === 'closed' ? 'STAGE_CLOSED' : 'STAGE_OPEN');

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
