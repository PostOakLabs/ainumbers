// art-284 — did:webvh DID Log Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-284-did-webvh-log-verifier.html
// Pure: no DOM, no window, no network. VERIFY-ONLY doctrine (GAP-C):
// this kernel verifies a supplied did:webvh DID log; it never operates
// witness/registry infrastructure and never resolves a live did:web(vh)
// document over the network.
//
// Standards pin (2026-07-10): did:webs LOST — DIF/ToIP June 2026 recommends
// did:webvh (github.com/decentralized-identity/did-webvh). This kernel
// implements the did:webvh self-certifying DID log verification model:
// per-entry self-hash integrity, sequential versionId numbering,
// update-key-authorized signatures on every entry, deactivation handling.
//
// SCOPE NOTE (v1): entry hashing uses the canonical _hash.mjs JCS
// canonicalizer + SHA-256 digest (NOT the did:webvh spec's default
// multihash/SCID digest algorithm negotiation) — a documented, honest
// simplification for a verify-only kernel, not a claim of full did:webvh
// conformance. JSON-serialized log entries only.

import { executionHash } from './_hash.mjs';
// RISC0 guest loader stub for _hash.mjs exports only executionHash, not cgCanon.
// Byte-identical to _hash.mjs cgCanon — inlined so this kernel runs unmodified in-guest.
const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;

const TOOL_ID = 'art-284-did-webvh-log-verifier';
const TOOL_VERSION = '1.0.0';
const DEFAULT_MAX_ENTRIES = 100;
const HARD_MAX_ENTRIES = 500;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_did_webvh_log',
  mandate_type: 'compliance_mandate', gpu: false,
};

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function canonJson(v) {
  return JSON.stringify(cgCanon(v));
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// base58 big-int decode (matches _proof.mjs b58d; kept local — no cross-kernel import).
function b58decodeCorrect(str) {
  let z = 0;
  while (z < str.length && str[z] === '1') z++;
  let num = 0n;
  for (let i = z; i < str.length; i++) {
    const c = B58.indexOf(str[i]);
    if (c < 0) throw new Error('bad base58');
    num = num * 58n + BigInt(c);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  return new Uint8Array([...Array(z).fill(0), ...bytes]);
}

// base64url, no padding (RFC 7515 §2) — for the Ed25519 JWK 'x' coordinate.
function bytesToBase64Url(bytes) {
  const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  const b64 = globalThis.btoa ? globalThis.btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// JWK import, not 'raw': the §24.5 VM WebCrypto bridge's importKey stub is JWK-shaped
// (host callback carries the JWK across the guest boundary, matching art-129's pattern);
// 'raw' format is a browser/worker-only path and silently diverges inside the zkVM guest.
async function didKeyToPublicKey(did) {
  if (!did || did.indexOf('did:key:z') !== 0) throw new Error('not a did:key (z-form)');
  const prefixed = b58decodeCorrect(did.slice('did:key:z'.length));
  if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) throw new Error('did:key is not Ed25519');
  const raw = prefixed.slice(2);
  const jwk = { kty: 'OKP', crv: 'Ed25519', x: bytesToBase64Url(raw) };
  return globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['verify']);
}

function b64ToBytes(b64) {
  const bin = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyEntrySignature(entryInput, proof, did) {
  try {
    const key = await didKeyToPublicKey(did);
    const sigBytes = b64ToBytes(proof.proofValue);
    const msgBytes = new TextEncoder().encode(canonJson(entryInput));
    return await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, sigBytes, msgBytes);
  } catch { return false; }
}

export async function compute(pp) {
  const did = pp.did ?? '';
  const rawLog = Array.isArray(pp.did_log) ? pp.did_log : null;
  const maxEntries = Math.min(Number(pp.max_entries ?? DEFAULT_MAX_ENTRIES) || DEFAULT_MAX_ENTRIES, HARD_MAX_ENTRIES);
  const expectedDocument = pp.expected_document ?? null;

  const failures = [];

  if (!did || typeof did !== 'string') failures.push({ entry_index: -1, code: 'DID_MISSING', detail: 'did is required' });
  if (!rawLog) failures.push({ entry_index: -1, code: 'LOG_NOT_ARRAY', detail: 'did_log must be an array' });

  if (!rawLog) {
    return {
      output_payload: { did, valid: false, entries_checked: 0, current_version_id: null, deactivated: false, failures },
      compliance_flags: ['DID_WEBVH_LOG_INVALID'],
    };
  }

  const boundedLog = rawLog.length > maxEntries ? rawLog.slice(0, maxEntries) : rawLog;
  if (rawLog.length > maxEntries) {
    failures.push({ entry_index: maxEntries, code: 'MAX_ENTRIES_EXCEEDED', detail: `log has ${rawLog.length} entries, bound is ${maxEntries}` });
  }

  let activeUpdateKeys = [];
  let priorVersionId = null;
  let deactivated = false;
  let currentVersionId = null;
  let entriesChecked = 0;
  let lastState = null;

  for (let idx = 0; idx < boundedLog.length; idx++) {
    if (deactivated) {
      failures.push({ entry_index: idx, code: 'DEACTIVATED_LOG_CONTINUED', detail: 'entries present after deactivation' });
      break;
    }
    const entry = boundedLog[idx] ?? {};
    entriesChecked++;

    const versionId = entry.versionId;
    const parameters = entry.parameters ?? {};
    const state = entry.state ?? null;
    const proofs = Array.isArray(entry.proof) ? entry.proof : (entry.proof ? [entry.proof] : []);

    if (typeof versionId !== 'string' || !/^\d+-[0-9a-f]{64}$/.test(versionId)) {
      failures.push({ entry_index: idx, code: 'VERSION_ID_MALFORMED', detail: String(versionId) });
      continue;
    }
    const [numPart, hashPart] = versionId.split('-');
    const entryNumber = parseInt(numPart, 10);
    if (entryNumber !== idx + 1) {
      failures.push({ entry_index: idx, code: 'SEQUENCE_BROKEN', detail: `expected entry number ${idx + 1}, got ${entryNumber}` });
    }

    const priorRef = idx === 0 ? (parameters.scid ?? null) : priorVersionId;
    if (idx === 0 && !priorRef) {
      failures.push({ entry_index: idx, code: 'SCID_MISSING', detail: 'first entry must declare parameters.scid' });
    }
    const entryInput = { versionId: priorRef, versionTime: entry.versionTime ?? null, parameters, state };
    const computedHash = await sha256Hex(canonJson(entryInput));
    if (computedHash !== hashPart) {
      failures.push({ entry_index: idx, code: 'ENTRY_HASH_MISMATCH', detail: `expected ${hashPart}, computed ${computedHash}` });
    }

    if (idx === 0) {
      if (!Array.isArray(parameters.updateKeys) || parameters.updateKeys.length === 0) {
        failures.push({ entry_index: idx, code: 'UPDATE_KEYS_MISSING', detail: 'first entry must declare parameters.updateKeys' });
      } else {
        activeUpdateKeys = parameters.updateKeys;
      }
    }

    if (proofs.length === 0) {
      failures.push({ entry_index: idx, code: 'PROOF_MISSING', detail: 'entry has no proof' });
    } else {
      let anyAuthorized = false;
      for (const proof of proofs) {
        const vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod.split('#')[0] : proof.verificationMethod;
        if (!activeUpdateKeys.includes(vm)) continue;
        const ok = await verifyEntrySignature(entryInput, proof, vm);
        if (ok) { anyAuthorized = true; break; }
      }
      if (!anyAuthorized) {
        failures.push({ entry_index: idx, code: 'UNAUTHORIZED_OR_INVALID_SIGNATURE', detail: 'no proof from an active updateKey verified' });
      }
    }

    // Rotation: new updateKeys take effect for the NEXT entry (this entry was
    // authorized by the PRIOR key set, checked above).
    if (idx > 0 && Array.isArray(parameters.updateKeys) && parameters.updateKeys.length > 0) {
      activeUpdateKeys = parameters.updateKeys;
    }

    if (parameters.deactivate === true) deactivated = true;
    currentVersionId = versionId;
    priorVersionId = versionId;
    lastState = state;
  }

  if (expectedDocument && lastState && canonJson(lastState) !== canonJson(expectedDocument)) {
    failures.push({ entry_index: boundedLog.length - 1, code: 'DOCUMENT_MISMATCH', detail: 'resolved state does not match expected_document' });
  }

  const valid = failures.length === 0;
  const output_payload = { did, valid, entries_checked: entriesChecked, current_version_id: currentVersionId, deactivated, failures };
  const compliance_flags = [valid ? 'DID_WEBVH_LOG_VALID' : 'DID_WEBVH_LOG_INVALID'];
  if (deactivated) compliance_flags.push('DID_WEBVH_DEACTIVATED');

  return { output_payload, compliance_flags };
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
