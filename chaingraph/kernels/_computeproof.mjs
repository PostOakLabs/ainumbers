// OpenChainGraph shared compute-integrity-proof helper — OCG Standard §18 (Compute-Integrity Proof).
// SINGLE SOURCE OF TRUTH for the §18 zkVM-receipt BINDING (attach + binding check).
//
// §18 turns the §4 hash from re-execute-to-verify into a SUCCINCT proof of correct execution — verifiable
// without re-execution and, optionally, without seeing the inputs (confidentiality, §18.3). OCG's analogue
// of the chained-verifiable-computation goal in Trusted Compute Units (arXiv:2504.15717), but SOFTWARE /
// CRYPTOGRAPHIC ONLY: no TEE, no hardware enclave, no blockchain anchor.
//
// HOME (NORMATIVE, §18.0): artifact.audit_signature.compute_proof — hash-excluded; never alters
// execution_hash or chaingraph_version (stays "0.4.0"); a v0.6 artifact still validates under the frozen
// v0.4 schema.
//
// SEAL VERIFICATION IS DELEGATED (NORMATIVE, §18.1): cryptographic verification of `seal` is performed by
// the NAMED system's vetted verifier (risc0/sp1 `verify`), exactly as §4 delegates SHA-256 and §16 delegates
// Ed25519 to WebCrypto. OCG specifies the BINDING, it does NOT re-implement a proof system. A self-contained
// BN254 Groth16 pairing-check verifier for receiptFormat:"groth16-bn254" is a RECOMMENDED reference (so a
// verifier is not runtime-dependent on the prover vendor); it is NOT shipped here and verifySeal() throws.
//
// PROVING IS OFF-BAND (NORMATIVE, §18.2): zkVM proving needs a Rust toolchain + heavy compute; it MUST NOT
// run in the browser tool, the Worker, or CI. A compute_proof is produced offline and attached; these
// helpers only ATTACH and VERIFY-THE-BINDING. Default-off (§18.3).

import { cgCanon } from './_hash.mjs';

// JCS-canonical compare (same canonicalizer as §4 — no second canonicalization path).
const canon = (o) => JSON.stringify(cgCanon(o ?? null));

// §18.1 — seal cryptographic verification is delegated, not implemented in OCG.
export const SEAL_VERIFICATION = 'delegated';
export const RECOMMENDED_RECEIPT_FORMAT = 'groth16-bn254';
const RECEIPT_FORMATS = new Set(['groth16-bn254', 'stark']);

// Attach a §18 compute_proof to an artifact (does NOT mutate the input; never touches the hash preimage).
export function attachComputeProof(artifact, receipt) {
  const out = structuredClone(artifact);
  out.audit_signature = { ...(out.audit_signature || {}), compute_proof: receipt };
  return out;
}

export function normId(d) {
  return typeof d === 'string' && d.startsWith('sha256:') ? d : 'sha256:' + d;
}

/**
 * §18.0/§18.1 BINDING check. Returns boolean (predicate — false on any structural/binding problem).
 * Checks: object shape (type/system/receiptFormat/imageId/seal/journal); journal binds output_payload
 * (journal.output JCS-equals artifact.output_payload); imageId published in the Graph Index
 * (node.compute_images[].image_id) when publishedImageIds is supplied.
 *
 * Does NOT verify the cryptographic seal — that is DELEGATED (§18.1, see verifySeal). A green binding
 * means "this receipt is well-formed and is ABOUT this artifact's output, by this published program";
 * the seal proves the program actually produced it, checked by the vendor verifier.
 */
export function verifyBinding(artifact, { publishedImageIds = [] } = {}) {
  const cp = artifact?.audit_signature?.compute_proof;
  if (!cp || typeof cp !== 'object') return false;
  if (cp.type !== 'ZkVmReceipt') return false;
  if (typeof cp.system !== 'string' || !cp.system) return false;
  if (!RECEIPT_FORMATS.has(cp.receiptFormat)) return false;
  if (typeof cp.imageId !== 'string' || !cp.imageId) return false;
  if (typeof cp.seal !== 'string' || !cp.seal) return false;
  if (!cp.journal || typeof cp.journal !== 'object') return false;
  // §18.0: the journal's committed output MUST equal the artifact output_payload.
  if (!('output' in cp.journal)) return false;
  if (canon(cp.journal.output) !== canon(artifact.output_payload)) return false;
  // §18.1: imageId must be a published program identity for this node.
  if (publishedImageIds.length && !publishedImageIds.map(normId).includes(normId(cp.imageId))) return false;
  return true;
}

/**
 * §18.1 — cryptographic seal verification is DELEGATED. This stub THROWS by design so no caller can
 * mistake a missing implementation for a passing proof (no silent-skip — the §15 discipline). Use the
 * named system's verifier (risc0/sp1) or the RECOMMENDED BN254 Groth16 reference verifier.
 */
export function verifySeal() {
  throw new Error(
    '§18.1: seal cryptographic verification is DELEGATED to the named zkVM verifier (risc0/sp1). ' +
    'OCG does not re-implement the proof system. For receiptFormat:"groth16-bn254" use a BN254 Groth16 ' +
    'pairing-check verifier (RECOMMENDED reference); for "stark" use the vendor verifier (e.g. risc0-verifier).'
  );
}
