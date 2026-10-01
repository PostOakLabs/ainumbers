// OpenChainGraph shared canonicalizer + execution hash.
// SINGLE SOURCE OF TRUTH for the execution_hash preimage (OCG Standard §2/§6).
// The worker (mcp-apps-poc/worker.mjs) imports this file directly (WORKER-HASH-SSOT-1); there is no separate worker-local copy.
// Runs unchanged in: browsers, Cloudflare Workers, Node 18+ (all expose
// globalThis.crypto.subtle). Import this from BOTH the browser tool (inlined
// at build by generate.mjs) and the Worker so the two runtimes can never drift.
//
// Canonicalization (OCG §6): recursively sort object keys by Unicode code
// point, preserve array order, emit minimal-whitespace JSON, SHA-256, hex.
//
// RFC 8785 (JSON Canonicalization Scheme) alignment: for the I-JSON subset,
// jcsStringify() reproduces JCS output. JSON.stringify already uses the ECMAScript
// Number->String production and the minimal JSON string escaping that RFC 8785 §3.2
// mandates, and jcsStringify() orders member names by UTF-16 code unit while building
// the string directly, so RFC 8785 §3.2.3 member order holds even for array-index
// member names, which a JavaScript engine enumerates numerically. Every preimage
// without such names in a disagreeing order is byte-unchanged (2,575 of 2,575 pinned
// golden hashes verified 2026-09-28). The ONLY way this diverges from JCS is if a
// value is outside I-JSON (NaN/Infinity, or an integer beyond 2^53 that can't
// round-trip). assertIJson() rejects those so a non-canonical value can never
// silently produce an unstable hash.

// Structural limits. A payload deeper than MAX_DEPTH (or with more than MAX_ELEMENTS
// values) used to blow the JS stack with a bare `RangeError: Maximum call stack size
// exceeded` well below the worker's MAX_REQUEST_BODY_BYTES, i.e. an unbounded input
// produced an un-attributable crash instead of a named refusal. No committed payload
// comes near either ceiling, so nothing that hashes today starts failing.
export const MAX_DEPTH = 512;
export const MAX_ELEMENTS = 1_000_000;

export class HashLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HashLimitError';
  }
}

function walkIJson(v, depth, counter) {
  if (depth > MAX_DEPTH) throw new HashLimitError(`Input nests deeper than MAX_DEPTH (${MAX_DEPTH}); cannot canonicalize for hashing.`);
  if (++counter.n > MAX_ELEMENTS) throw new HashLimitError(`Input has more than MAX_ELEMENTS (${MAX_ELEMENTS}) values; cannot canonicalize for hashing.`);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number (${v}) is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 §3.2.2.3).`);
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error(`Integer ${v} exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).`);
  } else if (Array.isArray(v)) {
    for (const el of v) walkIJson(el, depth + 1, counter);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) walkIJson(v[k], depth + 1, counter);
  }
}

export function assertIJson(v) {
  walkIJson(v, 1, { n: 0 });
}

// JSON.stringify semantics that the hash preimage inherits, reproduced without an
// intermediate object:
//  - object members whose value is undefined / function / symbol are omitted
//  - array elements that are undefined / function / symbol / holes become null
//  - objects are enumerated by Object.keys (own enumerable string keys), sorted by
//    UTF-16 code unit with the default sort()
//  - primitives (string, number, boolean, null) via JSON.stringify (ES number format
//    = RFC 8785 §3.2.2.3)
// It builds the string directly, so array-index member names are no longer reordered
// by object enumeration order (RFC 8785 §3.2.3).
export function jcsStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    let s = '[';
    for (let i = 0; i < v.length; i++) {
      if (i) s += ',';
      const e = v[i];
      s += (e === undefined || typeof e === 'function' || typeof e === 'symbol') ? 'null' : jcsStringify(e);
    }
    return s + ']';
  }
  const keys = Object.keys(v).sort();
  let s = '{', first = true;
  for (const k of keys) {
    const e = v[k];
    if (e === undefined || typeof e === 'function' || typeof e === 'symbol') continue;
    if (!first) s += ',';
    first = false;
    s += JSON.stringify(k) + ':' + jcsStringify(e);
  }
  return s + '}';
}

// Legacy object sorter kept byte-stable for the kernels that import it; it is not
// RFC 8785-complete for array-index member names, which a JavaScript engine enumerates
// numerically; the §4 and §PPH-1 hash paths use jcsStringify.
// The accumulator is null-prototype so that a JSON member literally named "__proto__"
// lands as an ordinary own enumerable key in sorted position (RFC 8785 §3.2.3 knows no
// special member names). With a `{}` accumulator that assignment set the prototype
// instead, so the key AND its whole subtree silently vanished from the preimage.
export const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), Object.create(null))
    : v;

// The exact string that gets hashed. Exposed for debugging / parity proofs.
export function canonicalPreimage(policy_parameters, output_payload) {
  const obj = { policy_parameters, output_payload };
  assertIJson(obj); // fail loud on non-canonical input rather than emit an unstable hash
  return jcsStringify(obj);
}

// Bare lowercase hex (matches worker.mjs and the browser tools). No "sha256:" prefix.
export async function executionHash(policy_parameters, output_payload) {
  const bytes = new TextEncoder().encode(canonicalPreimage(policy_parameters, output_payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// OCG Standard §PPH-1 — JCS-SHA-256 of policy_parameters ALONE, via the same jcsStringify
// path executionHash() uses. Bare lowercase hex, no "sha256:" prefix. EXCLUDED from the
// execution_hash preimage by construction: this function never touches output_payload, and
// executionHash() never calls this one, so the member cannot reach the §4 preimage either way.
export async function policyParametersHash(policy_parameters) {
  assertIJson(policy_parameters);
  const bytes = new TextEncoder().encode(jcsStringify(policy_parameters));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
