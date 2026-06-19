// OpenChainGraph shared canonicalizer + execution hash.
// SINGLE SOURCE OF TRUTH for the execution_hash preimage (OCG Standard §2/§6).
// Byte-identical to mcp-apps-poc/worker.mjs cgCanon + cgExecutionHash.
// Runs unchanged in: browsers, Cloudflare Workers, Node 18+ (all expose
// globalThis.crypto.subtle). Import this from BOTH the browser tool (inlined
// at build by generate.mjs) and the Worker so the two runtimes can never drift.
//
// Canonicalization (OCG §6): recursively sort object keys by Unicode code
// point, preserve array order, emit minimal-whitespace JSON, SHA-256, hex.
//
// RFC 8785 (JSON Canonicalization Scheme) alignment: for the I-JSON subset,
// recursive key sort + per-value JSON.stringify reproduces JCS output —
// JSON.stringify already uses the ECMAScript Number->String production and the
// minimal JSON string escaping that RFC 8785 §3.2 mandates. The ONLY way this
// diverges from JCS is if a value is outside I-JSON (NaN/Infinity, or an
// integer beyond 2^53 that can't round-trip). assertIJson() rejects those so a
// non-canonical value can never silently produce an unstable hash.

function assertIJson(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number (${v}) is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 §3.2.2.3).`);
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error(`Integer ${v} exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).`);
  } else if (Array.isArray(v)) {
    v.forEach(assertIJson);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) assertIJson(v[k]);
  }
}

export const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {})
    : v;

// The exact string that gets hashed. Exposed for debugging / parity proofs.
export function canonicalPreimage(policy_parameters, output_payload) {
  const obj = { policy_parameters, output_payload };
  assertIJson(obj); // fail loud on non-canonical input rather than emit an unstable hash
  return JSON.stringify(cgCanon(obj));
}

// Bare lowercase hex (matches worker.mjs and the browser tools). No "sha256:" prefix.
export async function executionHash(policy_parameters, output_payload) {
  const bytes = new TextEncoder().encode(canonicalPreimage(policy_parameters, output_payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
