// OpenChainGraph shared kernel-identity helper — OCG Standard §17 (Kernel Identity Binding).
// SINGLE SOURCE OF TRUTH for the §17 kernel_digest + its binding check.
//
// §17 records the content digest of the EXACT kernel that produced an artifact, closing the §4 gap
// that execution_hash proves "output follows from inputs by SOME logic" but not WHICH logic ran.
//
// HOME (NORMATIVE, §17.0): the binding lives at artifact.audit_signature.build_identity — hash-excluded
// (like §16), so it never alters execution_hash or chaingraph_version (stays "0.4.0"), and a v0.6
// artifact still validates under the frozen v0.4 schema (audit_signature tolerates added properties).
//
// STRENGTH (NORMATIVE caveat, §17.2): §17 is an ADVISORY published claim of which kernel SOURCE ran —
// NOT a proof of execution. A dishonest server could record a digest different from the code it ran.
// Cryptographic proof that the named program produced the output is §18 (_computeproof.mjs).
//
// SHA-256 via globalThis.crypto.subtle: browsers, Cloudflare Workers, Node 18+. Zero external deps.

const enc = (s) => new TextEncoder().encode(s);

async function sha256hex(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Canonical source bytes (§17.0): UTF-8, LF-normalized (CRLF/CR -> LF). No trailing trim — the bytes
// are normalized, not edited, so the same source produces the same digest on any OS / git autocrlf.
export function normalizeSource(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// sha256:-prefixed digest over the canonical source bytes.
export async function sourceDigest(text) {
  return 'sha256:' + (await sha256hex(enc(normalizeSource(text))));
}

// Build a §17 build_identity object from kernel source text.
export async function buildIdentity(text, { buildType, source_ref } = {}) {
  if (!buildType) throw new Error('§17.0: build_identity requires a buildType (algorithm URI).');
  const bi = { kernel_digest: await sourceDigest(text), buildType };
  if (source_ref) bi.source_ref = source_ref;
  return bi;
}

// Attach a §17 build_identity to an artifact (does NOT mutate the input; never touches the hash preimage).
export function attachBuildIdentity(artifact, bi) {
  const out = structuredClone(artifact);
  out.audit_signature = { ...(out.audit_signature || {}), build_identity: bi };
  return out;
}

// Normalize a digest to sha256:-form for comparison (schema permits bare or prefixed).
export function normDigest(d) {
  return typeof d === 'string' && d.startsWith('sha256:') ? d : 'sha256:' + d;
}

/**
 * §17.1 three-way cross-check. Returns boolean (predicate — false on any structural/mismatch problem):
 *   artifact.audit_signature.build_identity.kernel_digest
 *     == recomputedDigest (from the deployed source)
 *     == one of publishedImageIds (Graph Index node.compute_images[].image_id, system "sha256-source").
 * publishedImageIds is optional; when empty the Graph Index leg is skipped (artifact↔source only).
 */
export function verifyBuildIdentity(artifact, { recomputedDigest, publishedImageIds = [] } = {}) {
  const bi = artifact?.audit_signature?.build_identity;
  if (!bi || typeof bi.kernel_digest !== 'string' || typeof bi.buildType !== 'string') return false;
  const a = normDigest(bi.kernel_digest);
  if (!recomputedDigest || normDigest(recomputedDigest) !== a) return false;
  if (publishedImageIds.length && !publishedImageIds.map(normDigest).includes(a)) return false;
  return true;
}

export const BUILDID_BUILDTYPE = 'https://ainumbers.co/chaingraph/context/v0.2#WebCryptoSHA256';
