// OCG Standard §21.6 — DAG ancestry commitment.
// ancestry_digest = SHA-256(cgCanon({ execution_hash, parent_ancestry_digests })), through the
// SAME shared canonicalizer §4/§PPH-1 use (kernels/_hash.mjs). No second canonicalization path.
// Root artifacts (parent_hashes: []) pass parent_ancestry_digests: [], so their ancestry_digest
// is a pure function of their own execution_hash.
import { cgCanon, assertIJson } from './_hash.mjs';

// Bare lowercase hex (matches worker.mjs and the browser tools). No "sha256:" prefix.
export async function ancestryDigest(execution_hash, parent_ancestry_digests) {
  const obj = { execution_hash, parent_ancestry_digests };
  assertIJson(obj); // fail loud on non-canonical input rather than emit an unstable digest
  const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(obj)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
