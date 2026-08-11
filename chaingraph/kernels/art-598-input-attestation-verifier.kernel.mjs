import { executionHash } from './_hash.mjs';

// The VM-parity harness only re-defines executionHash/policyParametersHash (see the top-of-file
// note) — cgCanon itself must be inlined, not imported, to stay VM-safe. Byte-identical to
// _hash.mjs's own cgCanon.
const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {})
    : v;

// NOTE ON SCOPE (§24 Deterministic Compute Profile, SPEC.md §24 / chaingraph/vm/README.md):
// every gpu:false live kernel runs inside the sandboxed QuickJS VM-parity gate, which strips
// every import except { executionHash, policyParametersHash } from './_hash.mjs' — verified
// against the full corpus (no kernel imports another kernel, _rfc3161.mjs, or node:crypto; the
// VM's crypto.subtle bridge is JWK-import-only, no SPKI/X.509). That makes _rfc3161.mjs's
// node:crypto-based CMS/X.509 chain verifier (and art-123's compute(), and _proof.mjs's
// artifact-shaped verify()) UNIMPORTABLE from a live node — the WU's original "import, don't
// copy-paste" instruction is superseded by this hard, whole-corpus constraint discovered while
// building this kernel. What follows is self-contained, VM-safe:
//   - rfc3161-snapshot: messageImprint binding is a pure DER byte read (no crypto) —
//     structural-only; verifiable stays 'n/a' (full CMS/X.509 chain verification needs
//     node:crypto, only available to the Node-only §20 gate, never a live sandboxed kernel).
//   - c2pa-manifest: art-123's structural rules are DUPLICATED here (small, ~15 lines) rather
//     than imported, for the same reason — art-123's own kernel source is untouched either way.
//   - vc-2.0: the eddsa-jcs-2022 Data Integrity check is reimplemented using ONLY the
//     JWK-import Ed25519 path already proven inside this VM by art-129 (crypto.subtle.importKey
//     'jwk' + verify) — the base58 decode is the same pure-JS routine every OCG-PROOF HTML page
//     already duplicates (established suite convention, not a new pattern).

const TOOL_ID = 'art-598-input-attestation-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_input_attestations',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const KNOWN_TYPES = new Set(['vc-2.0', 'c2pa-manifest', 'rfc3161-snapshot', 'zktls']);

// ── RFC 6901 JSON Pointer, evaluated against the target artifact's policy_parameters ────────────
function resolvePointer(doc, pointer) {
  if (typeof pointer !== 'string' || pointer === '' || pointer[0] !== '/') throw new Error('pointer must be a non-empty RFC 6901 string');
  const parts = pointer.split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = doc;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') throw new Error('pointer does not resolve');
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
  }
  if (cur === undefined) throw new Error('pointer does not resolve');
  return cur;
}

// SPEC.md §23 — SHA-256 of the cgCanon encoding of the resolved value. Same canon as executionHash.
async function canonicalDigestHex(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(value)));
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function freshnessStatus(freshness, verificationTime) {
  if (!freshness || typeof freshness !== 'object') return 'undeclared';
  if (typeof freshness.expires_at === 'string' && typeof verificationTime === 'string' && freshness.expires_at < verificationTime) return 'stale';
  return 'fresh';
}

// ── minimal DER reader (definite-length only) over Uint8Array — VM-safe (no Buffer/node:crypto) ──
function b64ToBytes(b64) {
  const bin = globalThis.atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function derRead(buf, off) {
  const tag = buf[off];
  let len = buf[off + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[off + 2 + i];
    hdr = 2 + n;
  }
  return { tag, start: off + hdr, end: off + hdr + len };
}
function derChildrenOf(buf, node) {
  const out = [];
  let off = node.start;
  while (off < node.end) { const c = derRead(buf, off); out.push(c); off = c.end; }
  return out;
}

// rfc3161-snapshot (SPEC.md §23.1) — STRUCTURAL ONLY inside the live kernel: extracts the CMS
// TimeStampToken's TSTInfo.messageImprint (pure DER byte read) and binds it to the resolved
// input's canonical digest, plus a genTime sanity check. Full CMS signature / X.509 chain-to-root
// verification (what the SAME algorithm does at _rfc3161.mjs's §20 gate) needs node:crypto's
// X509Certificate, unavailable inside the §24 deterministic VM every live kernel runs under —
// verifiable stays 'n/a' here, never silently presented as cryptographically confirmed.
function checkRfc3161Snapshot(entry, resolvedDigestHex) {
  const proofB64 = entry && entry.proof;
  if (typeof proofB64 !== 'string' || proofB64.length === 0) return { structural: 'fail', verifiable: 'n/a' };
  try {
    const der = b64ToBytes(proofB64);
    const ci = derRead(der, 0);
    const ciKids = derChildrenOf(der, ci);
    const explicit0 = ciKids[1]; // [0] EXPLICIT SignedData
    const signedData = derChildrenOf(der, explicit0)[0];
    const sdKids = derChildrenOf(der, signedData);
    const encapKids = derChildrenOf(der, sdKids[2]); // encapContentInfo { eContentType, [0] eContent }
    const tstInfoOctets = derRead(der, encapKids[1].start); // OCTET STRING inside [0] EXPLICIT
    const tstInfoDer = der.subarray(tstInfoOctets.start, tstInfoOctets.end);
    const t = derChildrenOf(tstInfoDer, derRead(tstInfoDer, 0));
    // TSTInfo: version, policy, messageImprint SEQ{alg, hash}, serialNumber, genTime, …
    const imprintKids = derChildrenOf(tstInfoDer, t[2]);
    const hashedMessage = tstInfoDer.subarray(imprintKids[1].start, imprintKids[1].end);
    const hashedMessageHex = Array.from(hashedMessage).map((b) => b.toString(16).padStart(2, '0')).join('');
    // genTime (GeneralizedTime) is always ASCII digits + 'Z' — plain byte->char, no TextDecoder
    // dependency (WHATWG Encoding globals are absent from the VM-parity QuickJS build).
    let genTime = '';
    for (let i = t[4].start; i < t[4].end; i++) genTime += String.fromCharCode(tstInfoDer[i]);
    const gm = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(genTime);
    const genTimeSane = !!gm;
    const structural = (hashedMessageHex === resolvedDigestHex && genTimeSane) ? 'pass' : 'fail';
    return { structural, verifiable: 'n/a' };
  } catch {
    return { structural: 'fail', verifiable: 'n/a' };
  }
}

// c2pa-manifest (SPEC.md §23.1) — structural: claim well-formedness, hard-binding assertion
// presence, claim-signature reference (art-123's own rules, duplicated — see the top-of-file
// note; art-123's kernel source is untouched), PLUS the §23 hard-binding digest-bind check.
function checkC2paManifest(entry, resolvedDigestHex) {
  const manifest = entry && entry.proof;
  if (!manifest || typeof manifest !== 'object') return { structural: 'fail', verifiable: 'n/a' };
  const { claim = {}, assertions = [], signature = {}, claim_generator } = manifest;
  const labels = Array.isArray(assertions) ? assertions.map((a) => a && a.label).filter(Boolean) : [];
  const hardBinding = Array.isArray(assertions) ? assertions.find((a) => a && (a.label === 'c2pa.hash.data' || a.label === 'c2pa.hash.bmff')) : null;
  const hasHardBinding = !!hardBinding;
  const claimWellFormed = typeof claim_generator === 'string' && claim_generator.length > 0 && typeof claim.format === 'string' && typeof claim.instanceID === 'string';
  const sigRefPresent = !!signature && (signature.present === true || typeof signature.alg === 'string');
  const digestBound = !!hardBinding && hardBinding.hash === resolvedDigestHex;
  const manifestValid = claimWellFormed && hasHardBinding && sigRefPresent;
  return { structural: (manifestValid && digestBound) ? 'pass' : 'fail', verifiable: 'n/a' };
}

// vc-2.0 (SPEC.md §23.1) — reimplements the eddsa-jcs-2022 Data Integrity check using ONLY the
// VM-proven Ed25519 JWK path (crypto.subtle.importKey('jwk',...) + verify — the same primitive
// art-129 already runs inside this VM). did:key -> raw Ed25519 pubkey -> JWK needs no DER/X.509
// (a did:key IS the raw 32-byte key, multicodec-prefixed) — no SPKI parsing required.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(str) {
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < str.length; i++) {
    const c = B58.indexOf(str[i]);
    if (c < 0) throw new Error('bad base58 character');
    let carry = c;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}
function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function didKeyToEd25519Jwk(did) {
  if (typeof did !== 'string' || did.indexOf('did:key:z') !== 0) throw new Error('not a did:key z-form');
  const prefixed = b58decode(did.slice('did:key:z'.length));
  if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) throw new Error('did:key is not Ed25519');
  const raw = prefixed.subarray(2);
  return { kty: 'OKP', crv: 'Ed25519', x: bytesToBase64Url(raw) };
}
async function checkVc20(entry, resolvedDigestHex) {
  const credential = entry && entry.proof;
  if (!credential || typeof credential !== 'object' || !credential.proof) return { structural: 'fail', verifiable: 'failed' };
  const { proof, ...bare } = credential;
  const digestBound = !!(credential.credentialSubject && credential.credentialSubject.digest === resolvedDigestHex);
  const proofWellFormed = proof && proof.type === 'DataIntegrityProof' && proof.cryptosuite === 'eddsa-jcs-2022'
    && proof.proofPurpose === 'assertionMethod' && typeof proof.verificationMethod === 'string' && typeof proof.proofValue === 'string' && proof.proofValue[0] === 'z';
  const structural = (proofWellFormed && digestBound) ? 'pass' : 'fail';
  if (structural !== 'pass') return { structural, verifiable: 'failed' };
  try {
    const jwk = didKeyToEd25519Jwk(proof.verificationMethod);
    const key = await globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
    const { proofValue, ...proofOpts } = proof;
    const optHash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(cgCanon(proofOpts)))));
    const docHash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(cgCanon(bare)))));
    const toSign = new Uint8Array(optHash.length + docHash.length);
    toSign.set(optHash, 0); toSign.set(docHash, optHash.length);
    const sig = b58decode(proofValue.slice(1));
    const ok = await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, sig, toSign);
    return { structural, verifiable: ok ? 'verified' : 'failed' };
  } catch {
    return { structural, verifiable: 'failed' };
  }
}

// zktls (SPEC.md §23.1) — no vendored verifier; structural fields only, verifiable always 'external'.
function checkZktls(entry) {
  const structOk = typeof entry?.source_ref === 'string' && entry.source_ref.length > 0
    && (typeof entry.proof === 'string' || (entry.proof !== null && typeof entry.proof === 'object'));
  return { structural: structOk ? 'pass' : 'fail', verifiable: 'external' };
}

export async function compute(pp) {
  const { target_policy_parameters = {}, input_attestations = [], verification_time } = pp;

  const attestations = [];
  for (const entry of Array.isArray(input_attestations) ? input_attestations : []) {
    const pointer = entry && typeof entry.pointer === 'string' ? entry.pointer : null;
    const type = entry && entry.type;
    const freshness_status = freshnessStatus(entry && entry.freshness, verification_time);

    if (!KNOWN_TYPES.has(type)) {
      attestations.push({ pointer, type: type ?? null, structural: 'fail', verifiable: 'n/a', freshness_status });
      continue;
    }

    let resolved, resolveOk = true;
    try { resolved = resolvePointer(target_policy_parameters, pointer); } catch { resolveOk = false; }
    if (!resolveOk) {
      attestations.push({ pointer, type, structural: 'fail', verifiable: 'n/a', freshness_status });
      continue;
    }
    const resolvedDigestHex = await canonicalDigestHex(resolved);

    let verdict;
    if (type === 'rfc3161-snapshot') verdict = checkRfc3161Snapshot(entry, resolvedDigestHex);
    else if (type === 'c2pa-manifest') verdict = checkC2paManifest(entry, resolvedDigestHex);
    else if (type === 'vc-2.0') verdict = await checkVc20(entry, resolvedDigestHex);
    else verdict = checkZktls(entry);

    attestations.push({ pointer, type, structural: verdict.structural, verifiable: verdict.verifiable, freshness_status });
  }

  const compliance_flags = ['INPUT_ATTESTATIONS_ASSESSED'];
  if (attestations.length === 0) {
    compliance_flags.push('ZERO_ATTESTATIONS');
  } else {
    const allStructuralPass = attestations.every((a) => a.structural === 'pass');
    compliance_flags.push(allStructuralPass ? 'ALL_ATTESTATIONS_STRUCTURAL_PASS' : 'ATTESTATION_STRUCTURAL_FAILURE_PRESENT');
    if (attestations.some((a) => a.verifiable === 'failed')) compliance_flags.push('ATTESTATION_CRYPTO_VERIFICATION_FAILED');
    if (attestations.some((a) => a.verifiable === 'external')) compliance_flags.push('ATTESTATION_EXTERNAL_VERIFICATION_ONLY');
  }

  // SPEC.md §23.2 — "A UI presenting attestations MUST keep the zero-attestation caveat visible."
  const output_payload = {
    zero_attestation_caveat_shown: true,
    attestation_count: attestations.length,
    attestations,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
