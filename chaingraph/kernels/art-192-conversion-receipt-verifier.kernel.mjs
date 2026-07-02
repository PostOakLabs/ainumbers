import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID = 'art-192-conversion-receipt-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_conversion_receipt',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Re-verifies an art-191 conversion receipt: recomputes binding_sha256 over the
// JCS-canonical receipt (minus binding_sha256) and compares, checks structure and
// hex fields, and optionally compares digests re-hashed from the actual files.
// Distinct from verify_execution_hash (a utility that verifies the §4 artifact
// ENVELOPE); this verifies the domain receipt INSIDE the artifact. Zero network,
// zero PII.

const HEX64 = /^[0-9a-f]{64}$/;

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compute(pp) {
  let receipt = pp?.receipt;
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });

  // Accept either an object or a pasted JSON string.
  if (typeof receipt === 'string') {
    try { receipt = JSON.parse(receipt); }
    catch { receipt = null; }
  }

  const structOk = !!receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
    receipt.receipt_version === '1.0' &&
    receipt.input && typeof receipt.input === 'object' &&
    receipt.output && typeof receipt.output === 'object' &&
    receipt.converter && typeof receipt.converter === 'object' &&
    typeof receipt.binding_sha256 === 'string';

  push('receipt_structure_and_version', structOk,
    structOk ? 'receipt_version 1.0 with input/output/converter/binding present' : 'missing or malformed receipt structure');

  if (!structOk) {
    return {
      output_payload: { verdict: 'malformed', binding_ok: false, checks },
      compliance_flags: { CONVERSION_RECEIPT_VERIFIED: true, RECEIPT_MALFORMED: true },
    };
  }

  const inHex = String(receipt.input.sha256 || '').toLowerCase();
  const outHex = String(receipt.output.sha256 || '').toLowerCase();
  push('input_sha256_is_64_hex', HEX64.test(inHex),
    HEX64.test(inHex) ? 'valid' : 'input.sha256 is not 64 hex');
  push('output_sha256_is_64_hex', HEX64.test(outHex),
    HEX64.test(outHex) ? 'valid' : 'output.sha256 is not 64 hex');

  const identityComplete = !!receipt.converter.name && !!receipt.converter.version;
  push('converter_identity_complete', identityComplete,
    identityComplete ? 'name and version present' : 'converter name and/or version missing');

  // Recompute the binding over the receipt minus binding_sha256, byte-identical to art-191.
  const { binding_sha256, ...core } = receipt;
  const recomputed = await sha256Hex(JSON.stringify(cgCanon(core)));
  const binding_ok = recomputed === String(binding_sha256).toLowerCase();
  push('binding_sha256_matches', binding_ok,
    binding_ok ? 'recomputed binding equals stored binding' : `recomputed ${recomputed} != stored ${binding_sha256}`);

  // Optional: compare digests re-hashed from the actual files on the page.
  let digest_ok = true;
  const recIn = pp?.recomputed_input_sha256 ? String(pp.recomputed_input_sha256).toLowerCase() : null;
  const recOut = pp?.recomputed_output_sha256 ? String(pp.recomputed_output_sha256).toLowerCase() : null;
  if (recIn !== null) {
    const ok = recIn === inHex;
    digest_ok = digest_ok && ok;
    push('recomputed_input_digest_matches', ok,
      ok ? 'rehashed input matches receipt' : `rehashed input ${recIn} != receipt ${inHex}`);
  }
  if (recOut !== null) {
    const ok = recOut === outHex;
    digest_ok = digest_ok && ok;
    push('recomputed_output_digest_matches', ok,
      ok ? 'rehashed output matches receipt' : `rehashed output ${recOut} != receipt ${outHex}`);
  }

  let verdict;
  if (!binding_ok) verdict = 'binding_mismatch';
  else if (!digest_ok) verdict = 'digest_mismatch';
  else verdict = 'valid';

  const compliance_flags = { CONVERSION_RECEIPT_VERIFIED: true };
  compliance_flags['RECEIPT_' + verdict.toUpperCase()] = true;

  return {
    output_payload: { verdict, binding_ok, digest_ok, checks },
    compliance_flags,
  };
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
