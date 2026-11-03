/**
 * scripts/lib/detached-jws.mjs: the ONE detached-JWS (RFC 7515, EdDSA) implementation
 * shared by every local signer/verifier of the estate's section-16 key
 * (sign-agent-card.mjs, sign-webmcp-snapshot.mjs, check-webmcp-signed-snapshot.mjs).
 *
 * Signing input: `<protected>.<b64url(JCS(payload))>`, payload canonicalised with
 * jcsStringify from chaingraph/kernels/_hash.mjs (RFC 8785). The payload is detached:
 * it is the document itself minus its signatures[] member.
 *
 * KEY LAW: callers only ever name the key PATH; key bytes are never logged.
 * The `typ` protected-header member separates document types, so a signature made for
 * one document class can never verify as another (callers pass the expected typ).
 */
import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { jcsStringify } from '../../chaingraph/kernels/_hash.mjs';
import { rawPubkeyToDidKey, didKeyToPublicKey } from '../../chaingraph/kernels/_proof.mjs';

const enc = (s) => new TextEncoder().encode(s);
export const b64u = (bytes) => Buffer.from(bytes).toString('base64url');

/** Payload b64url: JCS of the document without its signatures[] member. */
export function payloadB64(doc) {
  const d = structuredClone(doc);
  delete d.signatures;
  return b64u(enc(jcsStringify(d)));
}

/** Load a PKCS#8 Ed25519 PEM from a path; returns { privKey, kid } (did:key). */
export async function loadSigningKey(pemPath) {
  const nodeKey = createPrivateKey(readFileSync(pemPath, 'utf8'));
  const der = nodeKey.export({ format: 'der', type: 'pkcs8' });
  const privKey = await globalThis.crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
  const pubJwk = await globalThis.crypto.subtle.exportKey('jwk', privKey);
  const pubKey = await globalThis.crypto.subtle.importKey(
    'jwk', { kty: 'OKP', crv: 'Ed25519', x: pubJwk.x }, { name: 'Ed25519' }, true, ['verify'],
  );
  return { privKey, kid: await rawPubkeyToDidKey(pubKey) };
}

/** Detached JWS over `doc`; returns the signatures[] entry { protected, signature }. */
export async function signDetached(doc, { privKey, kid, typ }) {
  const protectedB64 = b64u(enc(JSON.stringify({ alg: 'EdDSA', kid, typ })));
  const input = enc(`${protectedB64}.${payloadB64(doc)}`);
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privKey, input));
  return { protected: protectedB64, signature: b64u(sig) };
}

/**
 * Verify every signatures[] entry of `doc`. `typ` is REQUIRED and must equal the
 * protected header's typ exactly. `pubPemPath` (tests only) overrides the
 * did:key-resolved key. Returns { ok, why?, kid? }.
 */
export async function verifyDetached(doc, { typ, pubPemPath } = {}) {
  const sigs = doc.signatures;
  if (!Array.isArray(sigs) || sigs.length === 0) return { ok: false, why: 'no signatures[] member (unsigned)' };
  const payload = payloadB64(doc);
  let firstKid;
  for (const s of sigs) {
    if (typeof s?.protected !== 'string' || typeof s?.signature !== 'string')
      return { ok: false, why: 'malformed signatures[] entry' };
    let header;
    try { header = JSON.parse(Buffer.from(s.protected, 'base64url').toString('utf8')); }
    catch { return { ok: false, why: 'protected header is not valid base64url JSON' }; }
    if (header.alg !== 'EdDSA') return { ok: false, why: `unexpected alg ${JSON.stringify(header.alg)} (want EdDSA)` };
    if (header.typ !== typ) return { ok: false, why: `typ ${JSON.stringify(header.typ)} is not ${JSON.stringify(typ)} (wrong document class)` };
    if (typeof header.kid !== 'string' || !header.kid.startsWith('did:key:')) return { ok: false, why: 'no did:key kid' };
    let pub;
    try {
      pub = pubPemPath
        ? await globalThis.crypto.subtle.importKey('spki', createPublicKey(readFileSync(pubPemPath, 'utf8')).export({ format: 'der', type: 'spki' }), { name: 'Ed25519' }, true, ['verify'])
        : await didKeyToPublicKey(header.kid);
    } catch (e) { return { ok: false, why: `public key did not resolve (${e.message})` }; }
    const ok = await globalThis.crypto.subtle.verify('Ed25519', pub, Buffer.from(s.signature, 'base64url'), enc(`${s.protected}.${payload}`));
    if (!ok) return { ok: false, why: `Ed25519 verify FAILED for kid ${header.kid}` };
    firstKid ??= header.kid;
  }
  return { ok: true, kid: firstKid };
}
