// art-390 — TIP-20 Memo/Commitment Validator.
// Pure decision kernel -- no DOM, no window, no Date.now(), no network.
//
// TIP-20 TransferWithMemo carries a 32-byte memo (docs.tempo.xyz/guide/payments/
// transfer-memos), which the docs prescribe using as a hash-or-locator
// commitment for larger or PII-bearing off-chain payloads. This kernel
// validates the memo's length/hex form and, when the caller supplies the
// off-chain payload (or an invoice ID under a declared locator template),
// recomputes the SHA-256 commitment and checks it against the memo.
//
// Distinct from screen_tip20_transfer_batch (art-38, AML/Travel Rule
// screening of a transfer batch): this kernel is integrity-only -- it never
// screens sanctions/AML, it only checks whether a memo commitment matches
// its claimed preimage.
//
// compute() is async because a real SHA-256 digest requires globalThis.crypto.
// subtle (the same primitive _hash.mjs uses), which is only available as an
// awaited call -- this mirrors the pattern already used by art-284/art-285.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-390-tip20-memo-commitment-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_tip20_memo_commitment',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const MEMO_BYTE_LENGTH = 32;
const MEMO_HEX_LENGTH = MEMO_BYTE_LENGTH * 2;
const DEFAULT_INVOICE_LOCATOR_TEMPLATE = 'invoice:{invoice_id}';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function normalizeHex(s) {
  return typeof s === 'string' ? s.trim().replace(/^0x/i, '').toLowerCase() : '';
}

export async function compute(pp) {
  pp = pp || {};
  const memo_hex = normalizeHex(pp.memo_hex);
  const payload = typeof pp.payload === 'string' ? pp.payload : null;
  const invoice_id = typeof pp.invoice_id === 'string' && pp.invoice_id ? pp.invoice_id : null;
  const invoice_locator_template = typeof pp.invoice_locator_template === 'string' && pp.invoice_locator_template
    ? pp.invoice_locator_template
    : DEFAULT_INVOICE_LOCATOR_TEMPLATE;

  const memo_length_valid = memo_hex.length === MEMO_HEX_LENGTH;
  const memo_hex_valid = memo_length_valid && /^[0-9a-f]{64}$/.test(memo_hex);

  const compliance_flags = [];
  if (!memo_length_valid) compliance_flags.push('MEMO_LENGTH_INVALID');
  else if (!memo_hex_valid) compliance_flags.push('MEMO_NOT_HEX');

  let payload_commitment = null;
  let payload_commitment_match = null;
  if (payload !== null) {
    payload_commitment = await sha256Hex(payload);
    payload_commitment_match = memo_hex_valid && payload_commitment === memo_hex;
    if (payload_commitment_match === false) compliance_flags.push('PAYLOAD_COMMITMENT_MISMATCH');
  }

  let invoice_locator = null;
  let invoice_locator_commitment = null;
  let invoice_locator_match = null;
  if (invoice_id !== null) {
    invoice_locator = invoice_locator_template.replace('{invoice_id}', invoice_id);
    invoice_locator_commitment = await sha256Hex(invoice_locator);
    invoice_locator_match = memo_hex_valid && invoice_locator_commitment === memo_hex;
    if (invoice_locator_match === false) compliance_flags.push('INVOICE_LOCATOR_COMMITMENT_MISMATCH');
  }

  const commitment_source_supplied = payload !== null || invoice_id !== null;
  if (!commitment_source_supplied) compliance_flags.push('NO_COMMITMENT_SOURCE_SUPPLIED');

  const overall_valid = memo_hex_valid && (
    !commitment_source_supplied
      ? true
      : (payload_commitment_match === true || invoice_locator_match === true)
  );

  const output_payload = {
    memo_hex: memo_hex || null,
    memo_length_valid,
    memo_hex_valid,
    payload_commitment,
    payload_commitment_match,
    invoice_locator,
    invoice_locator_commitment,
    invoice_locator_match,
    commitment_source_supplied,
    overall_valid,
    note: 'Integrity check only -- distinct from screen_tip20_transfer_batch (art-38 AML/Travel Rule screening). Memo is a fixed 32-byte hash-or-locator commitment per docs.tempo.xyz/guide/payments/transfer-memos.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
