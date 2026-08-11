// digest.mjs — canonical source digest, extracted verbatim from chaingraph/kernels/_buildid.mjs
// (sourceDigest + normalizeSource only — the rest of _buildid.mjs is chaingraph-artifact-specific
// and out of scope for this package). SHA-256 via globalThis.crypto.subtle: Node 18+, zero deps.

const enc = (s) => new TextEncoder().encode(s);

async function sha256hex(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// LF-normalized (CRLF/CR -> LF), no trailing trim — same source produces the same digest on any OS.
export function normalizeSource(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function sourceDigest(text) {
  return 'sha256:' + (await sha256hex(enc(normalizeSource(text))));
}
