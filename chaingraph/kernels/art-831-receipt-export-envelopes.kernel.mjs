import { executionHash } from './_hash.mjs';

// art-831 — Receipt Export Envelopes: deterministically re-express one caller-supplied
// execution receipt as two wire envelopes so lineage and eventing stacks can ingest the
// estate's receipts without a custom adapter:
//   1. a lineage RunEvent in the estate's dataset-facet dialect (inputs are
//      {namespace, name} records, one per parent hash, named by hash);
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
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/;

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
  // RFC 3339 numoffset: time-numoffset hours 00-23, minutes 00-59.
  if (m[9] !== undefined && (+m[9] > 23 || +m[10] > 59)) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const dim = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= dim;
}

// URI-reference acceptance per RFC 3986 section 4.1 (URI / relative-ref): printable
// US-ASCII only, every percent sign part of a valid %XX escape, and the string must
// parse against the grammar: an absolute URI needs a scheme of ALPHA *( ALPHA / DIGIT
// / "+" / "-" / "." ) before its first colon, a relative reference's first path segment
// may not contain a colon, and "[" "]" appear only around an IP-literal host.
// RFC 3986 excludes space, double quote, < > { } | backslash ^ and backtick outright.
// Pure string and regex work over a string, so it cannot throw.
const URI_FORBIDDEN = /[^\x21-\x7e]|["<>{}|\\^`]/;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const URI_USERINFO = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:]|%[0-9A-Fa-f]{2})*$/;
const URI_REGNAME = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=]|%[0-9A-Fa-f]{2})*$/;
const URI_PATH = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/]|%[0-9A-Fa-f]{2})*$/;
const URI_QUERY_FRAG = /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9A-Fa-f]{2})*$/;
const URI_IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const URI_IPFUTURE = /^[vV][0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+$/;
// h16 groups of an IPv6address; the final group may be a dotted IPv4 (counts as two).
function ipv6Groups(str, allowV4Last) {
  if (str === '') return 0;
  const parts = str.split(':');
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (allowV4Last && i === parts.length - 1 && p.indexOf('.') !== -1) {
      if (!URI_IPV4.test(p)) return -1;
      n += 2;
    } else if (/^[0-9A-Fa-f]{1,4}$/.test(p)) {
      n += 1;
    } else {
      return -1;
    }
  }
  return n;
}
function isIPv6(s) {
  if (!/^[0-9A-Fa-f:.]+$/.test(s) || s.indexOf(':::') !== -1) return false;
  const dbl = s.indexOf('::');
  if (dbl === -1) return ipv6Groups(s, true) === 8;
  if (dbl !== s.lastIndexOf('::')) return false;
  const a = ipv6Groups(s.slice(0, dbl), false);
  const b = ipv6Groups(s.slice(dbl + 2), true);
  return a >= 0 && b >= 0 && a + b <= 7;
}
function isUriAuthority(auth) {
  const at = auth.indexOf('@');
  if (at !== -1) {
    if (!URI_USERINFO.test(auth.slice(0, at))) return false;
    auth = auth.slice(at + 1);
  }
  let host = auth, port = '';
  if (auth.charAt(0) === '[') {
    const close = auth.indexOf(']');
    if (close === -1) return false;
    const inner = auth.slice(1, close);
    const rest = auth.slice(close + 1);
    if (rest !== '' && !/^:\d*$/.test(rest)) return false;
    return isIPv6(inner) || URI_IPFUTURE.test(inner);
  }
  const colon = auth.indexOf(':');
  if (colon !== -1) { host = auth.slice(0, colon); port = auth.slice(colon + 1); }
  return /^\d*$/.test(port) && URI_REGNAME.test(host);
}
function isUriReference(v) {
  if (typeof v !== 'string' || v.length === 0) return false;
  if (URI_FORBIDDEN.test(v)) return false;
  let rest = v;
  let frag = null, query = null;
  const hash = rest.indexOf('#');
  if (hash !== -1) { frag = rest.slice(hash + 1); rest = rest.slice(0, hash); }
  const qm = rest.indexOf('?');
  if (qm !== -1) { query = rest.slice(qm + 1); rest = rest.slice(0, qm); }
  if (frag !== null && !URI_QUERY_FRAG.test(frag)) return false;
  if (query !== null && !URI_QUERY_FRAG.test(query)) return false;
  // A colon before any "/" (the part left after "?" and "#" are cut) marks a scheme.
  const colon = rest.indexOf(':');
  const slash = rest.indexOf('/');
  let hasScheme = false;
  if (colon !== -1 && (slash === -1 || colon < slash)) {
    if (!URI_SCHEME.test(rest.slice(0, colon))) return false;
    hasScheme = true;
    rest = rest.slice(colon + 1);
  }
  let hasAuthority = false;
  if (rest.slice(0, 2) === '//') {
    hasAuthority = true;
    const end = rest.indexOf('/', 2);
    const auth = end === -1 ? rest.slice(2) : rest.slice(2, end);
    if (!isUriAuthority(auth)) return false;
    rest = end === -1 ? '' : rest.slice(end);
  }
  if (!URI_PATH.test(rest)) return false;
  // relative-ref path-noscheme: no colon in the first segment (a scheme-less reference).
  if (!hasScheme && !hasAuthority && rest.split('/')[0].indexOf(':') !== -1) return false;
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
    inputs: ph.map((h) => ({ namespace: r.namespace, name: h })),
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

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite
// number or an integer outside the 2^53 safe range, nesting past its MAX_DEPTH, more values
// than its MAX_ELEMENTS. Reports { reason, detail } with the path and kind only, never the
// value; null when the subtree is safe to hash. The shared _hash.mjs stays untouched.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

// `now` is passed in, never read from a clock. When the shared canonicalizer would refuse
// the {policy_parameters, output_payload} preimage, the artifact is minted with a null
// execution_hash and the reason beside it instead of letting the hash throw (D6):
// buildArtifact never throws on any input.
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
