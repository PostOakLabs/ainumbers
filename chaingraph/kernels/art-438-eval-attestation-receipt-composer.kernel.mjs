import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-438-eval-attestation-receipt-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compose_eval_attestation_receipt',
  mandate_type: 'governance_mandate', gpu: false,
};

// POSTCAMPAIGN-BAND-SPEC.md §PC-6 — eval-attestation receipt profile. Composes shipped
// carriers (§16 signature, §20/§20.1 anchor, §22 Work Mandate) around a THIRD PARTY eval
// log — it never executes, re-runs, re-scores, or grades the eval itself. VERIFY-ONLY
// (honesty guard, binding): this kernel hashes/binds an eval_log digest the caller already
// produced; the §16 signature and §20 anchor are envelope-level additions applied by the
// tool/worker AFTER hashing (same pattern as every other kernel here), not computed inside
// compute(). claim_strength is the weakest-link status across {eval_log hash present,
// mandate_reference bound} — never inflated by one strong leg covering a missing other.
const HEX64 = /^[0-9a-f]{64}$/;

function isSha256(v) {
  return typeof v === 'string' && v.startsWith('sha256:') && HEX64.test(v.slice(7));
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const evalLog = (pp.eval_log !== null && typeof pp.eval_log === 'object') ? pp.eval_log : {};
  const mandateRef = (pp.mandate_reference !== null && typeof pp.mandate_reference === 'object') ? pp.mandate_reference : null;

  const evalLogHash = isSha256(evalLog.hash) ? evalLog.hash : null;
  const evalFormat = typeof evalLog.format === 'string' && evalLog.format ? evalLog.format : 'inspect_ai_eval_log';
  const mandateHash = mandateRef && isSha256(mandateRef.work_mandate_hash) ? mandateRef.work_mandate_hash : null;
  const mandateBound = mandateHash !== null;

  let claim_strength;
  if (!evalLogHash) claim_strength = 'missing';
  else if (mandateBound) claim_strength = 'mandate-bound';
  else claim_strength = 'hash-only';

  const attestation_determination = evalLogHash ? 'ATTESTED' : 'INSUFFICIENT_EVIDENCE';

  const verify_instructions = evalLogHash
    ? `Recompute SHA-256 of the referenced ${evalFormat} eval log bytes and confirm it equals ${evalLogHash}; this receipt is VERIFY-ONLY and does not re-run, re-score, or grade the eval.`
    : null;

  const not_proven = [
    { item: 'Eval correctness or scoring validity', detail: 'This receipt attests only that a specific eval log digest was produced; it does not re-run, re-score, or otherwise validate the underlying evaluation.' },
    { item: 'Eval log completeness', detail: 'The hash covers exactly the log bytes supplied by the caller. A truncated, redacted, or cherry-picked log hashes correctly too.' },
    { item: 'Mandate satisfaction', detail: 'mandate_reference records a pointer to a compiled Work Mandate (art-274); whether the eval actually satisfies that mandate\'s policy conditions is a separate judgment, not made by this kernel.' },
    { item: 'Currency beyond generation time', detail: 'A §16 signature attests the artifact at generated_at; a §20 anchor (if attached) proves inclusion by a time. Neither proves the eval log is still current.' },
  ];

  const compliance_flags = ['EVAL_ATTESTATION_RECEIPT_BUILT'];
  compliance_flags.push(evalLogHash ? 'EVAL_LOG_HASH_BOUND' : 'EVAL_LOG_HASH_MISSING');
  compliance_flags.push(mandateBound ? 'MANDATE_REFERENCE_BOUND' : 'MANDATE_REFERENCE_ABSENT');

  const output_payload = {
    attestation_determination,
    eval_log_hash: evalLogHash,
    eval_format: evalFormat,
    eval_id: typeof evalLog.eval_id === 'string' ? evalLog.eval_id : null,
    mandate_reference: mandateBound ? { work_mandate_hash: mandateHash, policy_id: typeof mandateRef.policy_id === 'string' ? mandateRef.policy_id : null } : null,
    claim_strength,
    verify_instructions,
    not_proven,
  };

  return { output_payload, compliance_flags };
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
