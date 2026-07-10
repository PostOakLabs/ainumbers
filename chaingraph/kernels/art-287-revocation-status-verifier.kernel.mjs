// art-287 — Revocation-Status Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-287-revocation-status-verifier.html
// Pure: no DOM, no window, no network, no host crypto (no crypto.subtle;
// crypto.subtle is banned in the zkVM guest). No TextEncoder/TextDecoder.
//
// POST-CAMPAIGN §RV — REVOKE-R1. Normative source: SPEC.md §REVOKE-1 (cite,
// not restated here). §REVOKE-1.0: a `credentialStatus`-shaped object per
// W3C BitstringStatusList lives under `audit_signature` (hash-excluded,
// added-property-tolerant, chaingraph_version stays 0.4.0). §REVOKE-1.1:
// dereference statusListCredential, expand the bitstring, read the bit at
// statusListIndex — set means revoked, and revocation OVERRIDES §16
// signature validity. Absence of a credentialStatus is NOT evidence of
// active status ("absence != known-good") — it is its own no-signal state.
//
// Zero-egress scope: this browser/server tool never fetches
// statusListCredential over the network. The referenced BitstringStatusList
// credential's encoded list is a PASSED input (status_list_credential),
// exactly like every other OCG verify-only kernel treats its evidence.
//
// Bitstring encoding (bounded, exec-friendly, art-201 lesson): this kernel
// decodes `encodedList` as a plain base64url string of the RAW
// (uncompressed) bit-packed bytes, most-significant-bit first per byte —
// the same bit-indexing convention as W3C BitstringStatusList, minus the
// GZIP compression step. GZIP inflate is out of scope for a Size-S verify
// kernel (unbounded-time decompression risk inside a zkVM guest); the three
// published BitstringStatusList SDK test vectors are REFERENCE ONLY per
// §REVOKE-1.1 and are NOT vendored as a code path — fixtures here are
// test-side vectors in this kernel's own (uncompressed) encoding.
//
// Bounded inputs only: the decoded bitstring is capped at MAX_LIST_BYTES so
// this kernel runs over a small, finite, provable amount of data.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-287-revocation-status-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_revocation_status',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────
const MAX_LIST_BYTES = 8192; // 65,536 bits — well beyond any realistic fixture, still finite

// ── Pure base64url decode (no atob, no Buffer, no host API) ─────────────
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64urlDecode(str) {
  const s = String(str ?? '').replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const idx = B64URL_ALPHABET.indexOf(s[i]);
    if (idx === -1) return null; // invalid character = malformed
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

// bit 0 of the list = most-significant bit of byte 0 (W3C BitstringStatusList convention)
function bitAt(bytes, index) {
  const byteIndex = Math.floor(index / 8);
  const bitOffset = index % 8;
  return (bytes[byteIndex] >> (7 - bitOffset)) & 1;
}

/**
 * compute(pp) — pure §REVOKE-1 revocation-status verify kernel.
 * pp: {
 *   credential_status?: {
 *     statusListCredential?: string | null,  // URL, informational, NEVER fetched
 *     statusListIndex?: number,
 *     type?: string,                          // MUST be 'BitstringStatusListEntry'
 *   } | null,
 *   status_list_credential?: {
 *     encodedList?: string,                   // base64url, raw bit-packed bytes (uncompressed)
 *   } | null,
 * }
 */
export function compute(pp) {
  const credentialStatus = pp.credential_status ?? null;
  const statusListCredential = pp.status_list_credential ?? null;

  // ── absence != known-good: no credentialStatus at all is its own state ──
  if (credentialStatus === null || credentialStatus === undefined) {
    const output_payload = {
      status: 'no-signal',
      revoked_for_purpose: null,
      structural_error: null,
      status_list_index: null,
      status_list_credential_url: null,
      note: 'No credentialStatus was supplied on the receipt; absence is not evidence of active status.',
    };
    return { output_payload, compliance_flags: ['REVOKE_STATUS_NO_SIGNAL'] };
  }

  const listUrl = credentialStatus.statusListCredential ?? null;
  const index = credentialStatus.statusListIndex;
  const type = credentialStatus.type ?? null;

  let structuralError = null;
  if (type !== 'BitstringStatusListEntry') {
    structuralError = `credentialStatus.type must be "BitstringStatusListEntry"; got ${JSON.stringify(type)}.`;
  } else if (!Number.isInteger(index) || index < 0) {
    structuralError = `credentialStatus.statusListIndex must be a non-negative integer; got ${JSON.stringify(index)}.`;
  }

  let bytes = null;
  if (!structuralError) {
    const encodedList = statusListCredential ? statusListCredential.encodedList : undefined;
    if (typeof encodedList !== 'string' || encodedList.length === 0) {
      structuralError = 'No status_list_credential.encodedList was supplied (zero-egress: the BitstringStatusList credential must be passed as input, never fetched).';
    } else {
      bytes = base64urlDecode(encodedList);
      if (bytes === null) {
        structuralError = 'status_list_credential.encodedList is not valid base64url.';
      } else if (bytes.length > MAX_LIST_BYTES) {
        structuralError = `Decoded status list (${bytes.length} bytes) exceeds the ${MAX_LIST_BYTES}-byte bound.`;
      }
    }
  }

  if (!structuralError && bytes !== null && Math.floor(index / 8) >= bytes.length) {
    structuralError = `statusListIndex ${index} is out of range for a ${bytes.length * 8}-bit status list.`;
  }

  if (structuralError) {
    const output_payload = {
      status: 'no-signal',
      revoked_for_purpose: null,
      structural_error: structuralError,
      status_list_index: Number.isInteger(index) ? index : null,
      status_list_credential_url: listUrl,
      note: 'Malformed or out-of-range status reference; treated as no-signal, never as active.',
    };
    return { output_payload, compliance_flags: ['REVOKE_STATUS_STRUCTURAL_ERROR'] };
  }

  const bit = bitAt(bytes, index);
  const revoked = bit === 1;
  const status = revoked ? 'revoked' : 'active';

  const output_payload = {
    status,
    revoked_for_purpose: revoked,
    structural_error: null,
    status_list_index: index,
    status_list_credential_url: listUrl,
    note: revoked
      ? 'Bit set at statusListIndex: revoked. Revocation OVERRIDES signature validity per SPEC.md §REVOKE-1.1 even if the receipt\'s §16 signature is cryptographically valid.'
      : 'Bit clear at statusListIndex: active per this status list, as of the point in time the list was retrieved.',
  };

  const compliance_flags = [revoked ? 'REVOKE_STATUS_REVOKED' : 'REVOKE_STATUS_ACTIVE'];
  if (revoked) compliance_flags.push('ESCALATION_RAISED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
