import { executionHash } from './_hash.mjs';

// art-831 — Receipt Export Envelopes: deterministically re-express one caller-supplied
// execution receipt as two wire envelopes so lineage and eventing stacks can ingest the
// estate's receipts without a custom adapter:
//   1. a lineage RunEvent in the estate's dataset-facet dialect (inputs are
//      {namespace, name, type} records, one per parent hash, named by hash);
//   2. an event envelope in structured-mode JSON (specversion/id/source/type/time/
//      datacontenttype/data), with `data` echoing the receipt fields verbatim.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the input receipt is
// caller-supplied and caller-asserted. This kernel performs no verification of the hash
// values themselves, no clock read, no randomness and no network. It is a pure, total
// mapping from a validated receipt to two JSON envelopes — fail-closed on any missing or
// malformed hash, timestamp or URI-reference.
//
// runId bit layout (deterministic, no clock, no randomness): take the first 16 bytes of
// the receipt's execution_hash; set the version nibble of byte 6 to 8 (b[6] = (b[6] &
// 0x0f) | 0x80) and the two variant bits of byte 8 to 10 (b[8] = (b[8] & 0x3f) | 0x80);
// format as canonical lowercase 8-4-4-4-12 hex. Same receipt in, same runId out — the
// identifier is a pure function of the receipt, not of the moment of export.
//
// Determinism: compute() is a PURE function of pp — no clock read, no randomness source,
// no network, no filesystem, no guest-environment builtin of any kind (it runs unmodified
// inside the QuickJS-ng zkVM guest, where the browser byte/decode globals are ABSENT).

const TOOL_ID = 'art-831-receipt-export-envelopes';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'export_receipt_lineage_events',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// Pinned producer/schemaURL pair (the spec snapshot this node is validated against).
const SCHEMA_URL = 'https://raw.githubusercontent.com/OpenLineage/OpenLineage/1.55.0/spec/OpenLineage.json';
const PRODUCER = 'https://github.com/OpenLineage/OpenLineage/blob/1.55.0/spec/OpenLineage.json';
const EVENT_TYPE = 'co.ainumbers.ocg.receipt.v1';

const HEX64 = /^[0-9a-f]{64}$/;
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function isHex64(v) {
  return typeof v === 'string' && HEX64.test(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isTimestamp(v) {
  if (typeof v !== 'string') return false;
  const m = TS_RE.exec(v);
  if (!m) return false;
  const year = +m[1], month = +m[2], day = +m[3];
  const hour = +m[4], minute = +m[5], second = +m[6];
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 60) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const dim = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= dim;
}

// URI-reference acceptance: printable US-ASCII only — no whitespace, no control
// characters, no non-ASCII code points, no raw delimiter characters that must be
// percent-encoded — and every percent sign part of a valid %XX escape. Absolute or
// relative both accepted (a URI-reference, not a URI).
const URI_FORBIDDEN = /[^\x21-\x7e]/;
function isUriReference(v) {
  if (typeof v !== 'string' || v.length === 0) return false;
  if (URI_FORBIDDEN.test(v)) return false;
  let i = v.indexOf('%');
  while (i !== -1) {
    if (i + 2 >= v.length) return false;
    const h = v.slice(i + 1, i + 3);
    if (!/^[0-9A-Fa-f]{2}$/.test(h)) return false;
    i = v.indexOf('%', i + 1);
  }
  return true;
}

function hexToBytes(hex) {
  const out = new Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function runIdFromHash(hash) {
  const b = hexToBytes(hash.slice(0, 32));
  b[6] = (b[6] & 0x0f) | 0x80; // version nibble -> 8
  b[8] = (b[8] & 0x3f) | 0x80; // variant bits -> 10x
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
}

// Fail-closed validation, extracted so the refusal outcome is DATA (a [field, detail]
// pair or null) rather than a closure that emits its own flag literal. The refusal
// flag is emitted in compute() behind the branch the refusal datum earned — the
// sanctioned conditional-emission shape for FLAGS-COMPUTED-LINT-1 (art-113 pattern).
function receiptRefusal(r) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) {
    return ['receipt', 'pp.receipt must be a JSON object carrying the receipt to export.'];
  }

  const REQUIRED = ['tool_id', 'namespace', 'source', 'event_time', 'policy_parameters_hash', 'parent_hashes', 'parent_tool_ids', 'execution_hash', 'chain_depth'];
  for (const field of REQUIRED) {
    if (!(field in r)) return [field, 'receipt member is missing; export is fail-closed.'];
  }

  if (!isNonEmptyString(r.tool_id)) return ['tool_id', 'tool_id must be a non-empty string.'];
  if (!isNonEmptyString(r.namespace)) return ['namespace', 'namespace must be a non-empty string.'];
  if (!isUriReference(r.source)) return ['source', 'source must be a well-formed URI-reference (printable ASCII, valid percent-escapes, no whitespace or control characters).'];
  if (!isTimestamp(r.event_time)) return ['event_time', 'event_time must be a well-formed timestamp with date, time, optional fractional seconds and an offset.'];
  if (!isHex64(r.execution_hash)) return ['execution_hash', 'execution_hash must be a 64-character lowercase hex digest.'];
  if (!isHex64(r.policy_parameters_hash)) return ['policy_parameters_hash', 'policy_parameters_hash must be a 64-character lowercase hex digest.'];

  if (!Array.isArray(r.parent_hashes) || r.parent_hashes.some((h) => !isHex64(h))) {
    return ['parent_hashes', 'parent_hashes must be an array of 64-character lowercase hex digests.'];
  }
  if (!Array.isArray(r.parent_tool_ids) || r.parent_tool_ids.some((t) => !isNonEmptyString(t))) {
    return ['parent_tool_ids', 'parent_tool_ids must be an array of non-empty strings.'];
  }
  if (r.parent_hashes.length !== r.parent_tool_ids.length) {
    return ['parent_tool_ids', 'parent_hashes and parent_tool_ids must have the same length (one id per parent hash).'];
  }
  if (typeof r.chain_depth !== 'number' || !Number.isInteger(r.chain_depth) || r.chain_depth < 0) {
    return ['chain_depth', 'chain_depth must be a non-negative integer.'];
  }
  return null;
}

export function compute(pp) {
  pp = pp || {};
  const flags = [];

  const refusal = receiptRefusal(pp.receipt);
  if (refusal !== null) {
    flags.push('RECEIPT_EXPORT_REFUSED');
    return {
      output_payload: {
        status: 'refused',
        refused_field: refusal[0],
        reason: refusal[1],
        lineage_event: null,
        event_envelope: null,
        // Flag-mirror doctrine (AUTHORING-STANDARD, section 2.2): the conditional flag set
        // (RECEIPT_EXPORT_REFUSED vs RECEIPT_EXPORTED) is mirrored into output_payload
        // so existing gates can route on the refusal without reading the flag array.
        domain_errors: [refusal[1]],
      },
      compliance_flags: flags,
    };
  }

  const r = pp.receipt;
  const ph = r.parent_hashes;
  const pti = r.parent_tool_ids;

  const data = {
    tool_id: r.tool_id,
    execution_hash: r.execution_hash,
    parent_hashes: ph.slice(),
    parent_tool_ids: pti.slice(),
    chain_depth: r.chain_depth,
    policy_parameters_hash: r.policy_parameters_hash,
  };

  const lineage_event = {
    eventType: 'COMPLETE',
    eventTime: r.event_time,
    run: { runId: runIdFromHash(r.execution_hash) },
    job: { namespace: r.namespace, name: r.tool_id },
    inputs: ph.map((h) => ({ namespace: r.namespace, name: h, type: 'table' })),
    outputs: [],
    producer: PRODUCER,
    schemaURL: SCHEMA_URL,
  };

  const event_envelope = {
    specversion: '1.0',
    id: r.execution_hash,
    source: r.source,
    type: EVENT_TYPE,
    time: r.event_time,
    datacontenttype: 'application/json',
    data,
  };

  flags.push(refusal === null ? 'RECEIPT_EXPORTED' : 'RECEIPT_EXPORT_REFUSED');
  flags.push(ph.length === 0 ? 'RECEIPT_ROOT_NO_PARENTS' : 'RECEIPT_PARENTS_PRESENT');
  flags.push(ph.length > 1 ? 'RECEIPT_MULTI_PARENT' : 'RECEIPT_SINGLE_OR_NO_PARENT');

  return {
    output_payload: {
      status: 'exported',
      event_time: r.event_time,
      lineage_event,
      event_envelope,
      domain_errors: [],
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
