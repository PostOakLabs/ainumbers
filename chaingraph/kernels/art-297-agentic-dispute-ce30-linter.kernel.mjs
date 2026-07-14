import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-297-agentic-dispute-ce30-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_compelling_evidence_ce30_agentic',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (§GUARDS, AGENTIC-DISPUTE-WAVE-SPEC.md, binding): this lint asserts
// "these delegation + agent-identity + fulfillment artifacts replay to this evidence
// bundle" -- NEVER "this dispute is won" or "this transaction is authorized." Verify-side
// evidence assembly only. CE3.0 is Visa's compelling-evidence standard; this maps to it,
// it does not claim Visa/Mastercard acceptance or endorsement of the output.

function evalElement(obj, transaction_ref) {
  if (!obj || typeof obj !== 'object') return 'missing';
  const digest = typeof obj.digest === 'string' && obj.digest.length > 0 ? obj.digest : null;
  if (!digest) return 'missing';
  const bound = typeof obj.bound_transaction_ref === 'string' ? obj.bound_transaction_ref : null;
  return bound === transaction_ref ? 'present' : 'unbound';
}

function combine(a, b) {
  if (a === 'present' && b === 'present') return 'present';
  if (a === 'missing' && b === 'missing') return 'missing';
  return 'unbound';
}

export function compute(pp) {
  const dispute = (pp && typeof pp.dispute === 'object' && pp.dispute) || {};
  const evidence = (pp && typeof pp.evidence === 'object' && pp.evidence) || {};

  const network = typeof dispute.network === 'string' ? dispute.network : null;
  const reason_code = typeof dispute.reason_code === 'string' ? dispute.reason_code : null;
  const transaction_ref = typeof dispute.transaction_ref === 'string' ? dispute.transaction_ref : null;

  const authorization_at_delegation = evalElement(evidence.ap2_mandate, transaction_ref);
  const agent_identity = combine(
    evalElement(evidence.tap_signature, transaction_ref),
    evalElement(evidence.agentic_token, transaction_ref),
  );
  const fulfillment = evalElement(evidence.delivery_proof, transaction_ref);

  const per_element = [
    { element: 'authorization_at_delegation', status: authorization_at_delegation },
    { element: 'agent_identity', status: agent_identity },
    { element: 'fulfillment', status: fulfillment },
  ];

  // CE3.0 prior-transaction linkage test: >=2 matching data elements across >=2
  // undisputed prior transactions.
  let ce30_prior_txn_test = 'not_applicable';
  const prior_transactions = Array.isArray(evidence.prior_transactions) ? evidence.prior_transactions : null;
  if (prior_transactions && prior_transactions.length > 0) {
    const matching = prior_transactions.filter(
      (t) => t && Array.isArray(t.matched_data_elements) && t.matched_data_elements.length >= 2,
    ).length;
    ce30_prior_txn_test = matching >= 2 ? 'pass' : 'fail';
  }

  const missing_elements = per_element.filter((e) => e.status !== 'present').map((e) => e.element);
  if (ce30_prior_txn_test === 'fail') missing_elements.push('prior_transaction_test');

  const all_elements_present = per_element.every((e) => e.status === 'present');
  const ce30_readiness = all_elements_present && ce30_prior_txn_test !== 'fail' ? 'ready' : 'gaps';

  const insufficient_evidence = per_element.every((e) => e.status === 'missing');

  const compliance_flags = ['DISPUTE_CE30_ASSESSED', ce30_readiness === 'ready' ? 'DISPUTE_CE30_READY' : 'DISPUTE_CE30_GAPS'];

  return {
    output_payload: {
      network, reason_code,
      per_element,
      ce30_prior_txn_test,
      ce30_readiness,
      missing_elements,
      insufficient_evidence,
      not_a_win_prediction: 'Asserts that the supplied delegation, agent-identity, and fulfillment artifacts replay to this evidence bundle and, where supplied, meet the CE3.0 prior-transaction linkage test. Never a prediction of dispute outcome or a claim of Visa/Mastercard acceptance.',
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
