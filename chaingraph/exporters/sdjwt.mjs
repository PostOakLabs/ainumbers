// exporters/sdjwt.mjs — OCG Standard §13.12 selective-disclosure export profile (SD-JWT, RFC 9901).
//
// Renders an already-verified OpenChainGraph v0.4 artifact as an SD-JWT whose claims map
// DETERMINISTICALLY from the envelope — EXCEPT the disclosure salts, which MUST be freshly
// CSPRNG-generated per export (the one permitted nondeterminism; it is confined to the export and
// never touches the envelope or execution_hash).
//
// ALWAYS-DISCLOSED (non-selectively-disclosable): execution_hash, chaingraph_version, spec_version,
// compute_capability, §17 kernel/build identity fields, ALL outputs (output_payload), and timestamps.
// SELECTIVELY DISCLOSABLE: top-level input values only (the top-level members of
// policy_parameters.input_parameters).
//
// Signature: JWS (EdDSA) under the §16 signing key (Ed25519, WebCrypto; verificationMethod is the
// §16 did:key / did:web value). Like every §13 profile this is a VIEW, not a fact: it mints no new
// execution_hash. NORMATIVE limitation (§13.12, MUST be stated by presenting UIs): a redacted export
// is NOT re-executable and does NOT permit execution_hash recomputation; its verification yields
// (a) issuer-signature integrity and (b) hash-binding of each disclosed claim. The full envelope
// remains the artifact of record.
//
// Implementation: vendored @sd-jwt/core (see _sdjwt-core.bundle.mjs provenance header). This module
// injects WebCrypto Ed25519 + SHA-256 + a CSPRNG salt generator; no key material lives here, nothing
// runs unless a caller passes a private key (§16.2 default-off posture applies to the signing key).

import { SDJwtInstance, decodeSdJwt } from './_sdjwt-core.bundle.mjs';
import { exportFilename } from './_meta.mjs';

const MEDIA_TYPE = 'application/sd-jwt'; // RFC 9901 media type
const enc = (s) => new TextEncoder().encode(s);

// base64url without padding (RFC 4648 §5) — JWS/SD-JWT alphabet.
function b64u(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const hasher = async (data, _alg) =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc(data) : data));

// Fresh CSPRNG salt per disclosure — §13.12's one permitted nondeterminism.
const cspringSalt = (len) => b64u(globalThis.crypto.getRandomValues(new Uint8Array(len ?? 16)));

function instance({ privateKey, publicKey, saltGenerator }) {
  return new SDJwtInstance({
    signer: privateKey
      ? async (data) => b64u(new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privateKey, enc(data))))
      : undefined,
    verifier: publicKey
      ? async (data, sig) => globalThis.crypto.subtle.verify('Ed25519', publicKey, b64uDecode(sig), enc(data))
      : undefined,
    hasher,
    hashAlg: 'sha-256',
    signAlg: 'EdDSA',
    saltGenerator: saltGenerator ?? cspringSalt,
  });
}

// "Top-level input values" (§13.12): kernels emit either the canonical §1 shape
// policy_parameters.input_parameters{...} or fold inputs directly at policy_parameters top level
// (both valid — the schema's policy_parameters is not additionalProperties:false). The input
// container is input_parameters when present, else policy_parameters itself minus
// execution_backend (dispatch metadata, not an input value).
export function inputContainer(artifact) {
  const pp = artifact?.policy_parameters ?? {};
  if (pp.input_parameters && typeof pp.input_parameters === 'object' && !Array.isArray(pp.input_parameters)) {
    return { nested: true, keys: Object.keys(pp.input_parameters) };
  }
  return { nested: false, keys: Object.keys(pp).filter((k) => k !== 'execution_backend') };
}

// Deterministic claim mapping from the envelope (§13.12). Everything here is always-disclosed
// except the top-level input values (the disclosure frame below).
export function claimsFromArtifact(artifact, { spec_version, compute_capability } = {}) {
  if (!artifact || artifact.policy_parameters === undefined || artifact.output_payload === undefined) {
    throw new Error('A full v0.4 artifact (policy_parameters + output_payload + execution_hash) is required.');
  }
  const pp = artifact.policy_parameters ?? {};
  const claims = {
    // integrity anchor + version identity — always disclosed
    execution_hash: artifact.execution_hash ?? null,
    chaingraph_version: artifact.chaingraph_version ?? null,
    spec_version: spec_version ?? null,
    compute_capability: compute_capability ?? (artifact.compute_mode ?? null),
    // timestamps — always disclosed
    generated_at: artifact.generated_at ?? null,
    // envelope identity — always disclosed
    tool_id: artifact.tool_id ?? null,
    tool_version: artifact.tool_version ?? null,
    ...(artifact.mandate_type !== undefined ? { mandate_type: artifact.mandate_type } : {}),
    ...(artifact.compute_mode !== undefined ? { compute_mode: artifact.compute_mode } : {}),
    ...(artifact.chain !== undefined ? { chain: artifact.chain } : {}),
    // §17 kernel/build identity fields — always disclosed when present
    ...(artifact.audit_signature?.build_identity !== undefined
      ? { build_identity: artifact.audit_signature.build_identity }
      : {}),
    // ALL outputs — always disclosed, never redactable
    output_payload: artifact.output_payload ?? {},
    // inputs: execution_backend stays cleartext; top-level input values become disclosures
    policy_parameters: structuredClone(pp),
  };
  return claims;
}

// Disclosure frame: SELECTIVELY DISCLOSABLE = top-level input values only (§13.12).
export function disclosureFrameFromArtifact(artifact) {
  const { nested, keys } = inputContainer(artifact);
  if (!keys.length) return {};
  return nested
    ? { policy_parameters: { input_parameters: { _sd: keys } } }
    : { policy_parameters: { _sd: keys } };
}

/**
 * exportSdJwt(artifact, { privateKey, verificationMethod, spec_version, compute_capability?, saltGenerator? })
 * -> { sd_jwt, bytes, filename, media_type }
 * privateKey: WebCrypto Ed25519 private key (the §16 signing key). verificationMethod: the §16
 * did:key/did:web value, carried in the JOSE header as kid so a verifier resolves the key §16-style.
 */
export async function exportSdJwt(artifact, { privateKey, verificationMethod, spec_version, compute_capability, saltGenerator } = {}) {
  if (!privateKey || !verificationMethod) throw new Error('exportSdJwt requires { privateKey, verificationMethod } — the §16 signing key.');
  const sd = instance({ privateKey, saltGenerator });
  const claims = claimsFromArtifact(artifact, { spec_version, compute_capability });
  const frame = disclosureFrameFromArtifact(artifact);
  const sd_jwt = await sd.issue(claims, frame, { header: { kid: verificationMethod } });
  return {
    sd_jwt,
    bytes: enc(sd_jwt),
    filename: exportFilename(artifact, 'sd.jwt'),
    media_type: MEDIA_TYPE,
  };
}

/**
 * presentSdJwt(sd_jwt, presentationFrame) -> compact SD-JWT with only the framed disclosures kept.
 * presentationFrame example: { policy_parameters: { input_parameters: { keep_me: true } } }.
 */
export async function presentSdJwt(sd_jwt, presentationFrame) {
  const sd = instance({});
  return sd.present(sd_jwt, presentationFrame);
}

/**
 * verifySdJwt(sd_jwt, publicKey) -> { ok, payload?, error? }. Verification yields (a) issuer-signature
 * integrity and (b) hash-binding of each disclosed claim (§13.12) — it does NOT re-execute anything
 * and does NOT recompute execution_hash.
 */
export async function verifySdJwt(sd_jwt, publicKey) {
  const sd = instance({ publicKey });
  try {
    const res = await sd.verify(sd_jwt);
    return { ok: true, payload: res.payload };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/**
 * assertProfileShape(sd_jwt, artifact) -> throws unless the §13.12 always-disclosed/redactable split
 * is exactly honored by this export: (1) every top-level input is redactable (its key appears in NO
 * cleartext claim, only via disclosure digests), (2) no output is redactable (output_payload rides
 * cleartext in the JWT payload, byte-for-byte the artifact's), (3) the always-disclosed set
 * (execution_hash, chaingraph_version, spec_version, compute_capability, §17 fields when present,
 * generated_at) is complete in the cleartext payload. Used by sd-export-roundtrip.test.mjs (§15).
 */
export async function assertProfileShape(sd_jwt, artifact) {
  const decoded = await decodeSdJwt(sd_jwt, hasher);
  const payload = decoded.jwt.payload;
  const { nested, keys: inputKeys } = inputContainer(artifact);
  const cleartextInputs = (nested ? payload?.policy_parameters?.input_parameters : payload?.policy_parameters) ?? {};
  for (const k of inputKeys) {
    if (k in cleartextInputs) throw new Error(`§13.12 violation: input "${k}" leaked into the always-disclosed cleartext payload`);
  }
  const disclosedNames = decoded.disclosures.map((d) => d.key);
  for (const k of inputKeys) {
    if (!disclosedNames.includes(k)) throw new Error(`§13.12 violation: input "${k}" is not selectively disclosable`);
  }
  for (const name of disclosedNames) {
    if (!inputKeys.includes(name)) throw new Error(`§13.12 violation: non-input claim "${name}" became redactable`);
  }
  if (JSON.stringify(payload.output_payload) !== JSON.stringify(artifact.output_payload)) {
    throw new Error('§13.12 violation: output_payload is not fully always-disclosed');
  }
  for (const req of ['execution_hash', 'chaingraph_version', 'spec_version', 'compute_capability', 'generated_at']) {
    if (!(req in payload)) throw new Error(`§13.12 violation: always-disclosed claim "${req}" missing`);
  }
  if (artifact.audit_signature?.build_identity !== undefined && payload.build_identity === undefined) {
    throw new Error('§13.12 violation: §17 build identity fields missing from always-disclosed claims');
  }
  return true;
}
