#!/usr/bin/env node
/**
 * scripts/check-agent-card-sig.mjs — A2A-CARD-SIGN-1 (AGENT-REACH-BUILD-SPEC §3.8)
 *
 * Verifies the A2A 1.0 Signed Agent Card at /.well-known/agent-card.json with
 * WebCrypto against the public key published at /.well-known/jwks.json:
 *
 *   - detached-JWS verify: Ed25519 over `<protected>.<b64url(JCS(card minus signatures))>`
 *     (JCS = RFC 8785, the same canon as cgCanon in chaingraph/kernels/_hash.mjs —
 *     byte-identical to what scripts/sign-agent-card.mjs signed);
 *   - the protected header's `kid` MUST match a JWKS key's `kid` (§16 fingerprint
 *     convention: the did:key z6Mk… form, rawPubkeyToDidKey);
 *   - RED (exit 1) on: missing/empty signatures[], missing jwks.json, kid not in
 *     the JWKS, malformed protected header, or ANY verification failure.
 *
 * Drift law: the signed card is NOT a derived artifact (signing needs the §16
 * private key, which never touches the main-regen runner — see the EXCLUDED entry
 * in scripts/derived-artifacts.mjs). The card + signature are committed once by
 * the signing row; this gate on main means any LATER card content edit without a
 * local re-sign (node scripts/sign-agent-card.mjs) goes RED.
 *
 * Usage:
 *   node scripts/check-agent-card-sig.mjs               # verify (preflight gate)
 *   node scripts/check-agent-card-sig.mjs --self-test   # flip one card byte, expect the verify to FAIL
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';
import { didKeyToPublicKey } from '../chaingraph/kernels/_proof.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CARD_PATH = resolve(REPO, '.well-known', 'agent-card.json');
const JWKS_PATH = resolve(REPO, '.well-known', 'jwks.json');

const enc = (s) => new TextEncoder().encode(s);

function red(msg) {
  console.error(`✗ agent-card signature: ${msg}`);
  process.exit(1);
}

async function verifySignature(card) {
  const sigs = card.signatures;
  if (!Array.isArray(sigs) || sigs.length === 0) return { ok: false, why: 'no signatures[] member (unsigned card)' };
  const cardForCanon = structuredClone(card);
  delete cardForCanon.signatures; // the payload is the card WITHOUT its signatures (detached)
  const payloadB64 = Buffer.from(enc(JSON.stringify(cgCanon(cardForCanon)))).toString('base64url');
  for (const sig of sigs) {
    if (typeof sig?.protected !== 'string' || typeof sig?.signature !== 'string')
      return { ok: false, why: 'malformed signatures[] entry (protected/signature strings required)' };
    let header;
    try {
      header = JSON.parse(Buffer.from(sig.protected, 'base64url').toString('utf8'));
    } catch {
      return { ok: false, why: 'protected header is not valid base64url JSON' };
    }
    if (header.alg !== 'EdDSA') return { ok: false, why: `unexpected alg ${JSON.stringify(header.alg)} (want EdDSA)` };
    if (typeof header.kid !== 'string' || !header.kid.startsWith('did:key:'))
      return { ok: false, why: 'protected header has no did:key kid' };
    let pubKey;
    try {
      pubKey = await didKeyToPublicKey(header.kid); // resolves the did:key -> WebCrypto Ed25519 key
    } catch (e) {
      return { ok: false, why: `kid did not resolve to a raw Ed25519 key (${e.message})` };
    }
    const ok = await globalThis.crypto.subtle.verify(
      'Ed25519', pubKey, Buffer.from(sig.signature, 'base64url'), enc(`${sig.protected}.${payloadB64}`),
    );
    if (!ok) return { ok: false, why: `Ed25519 verify FAILED for kid ${header.kid} — card content does not match the signature` };
  }
  let kid;
  try {
    kid = JSON.parse(Buffer.from(sigs[0].protected, 'base64url').toString('utf8')).kid;
  } catch {
    return { ok: false, why: 'first signatures[] entry has an unreadable protected header' };
  }
  return { ok: true, kid };
}

// ── JWKS cross-check: the signed kid must be the published public key ─────────
function checkJwks(kid) {
  if (!existsSync(JWKS_PATH)) return 'no /.well-known/jwks.json on disk';
  let jwks;
  try {
    jwks = JSON.parse(readFileSync(JWKS_PATH, 'utf8'));
  } catch (e) {
    return `jwks.json is not valid JSON (${e.message})`;
  }
  const key = (jwks.keys || []).find((k) => k.kty === 'OKP' && k.crv === 'Ed25519' && k.kid === kid);
  if (!key) return `signing kid ${kid} not present in jwks.json keys`;
  return null;
}

const selfTest = process.argv.includes('--self-test');
const card = JSON.parse(readFileSync(CARD_PATH, 'utf8'));
if (!card.protocolVersion) red('card has no protocolVersion — not an A2A agent card?');

if (selfTest) {
  // SO #40b fixture proof: flip ONE byte of real card content (the version string),
  // expect the verify to fail — proves the gate is actually reading the bytes.
  const mutated = structuredClone(card);
  mutated.version = mutated.version === '0.0.0-tampered' ? '0.0.0-tampered2' : '0.0.0-tampered';
  const r = await verifySignature(mutated);
  if (r.ok) red('SELF-TEST INCONCLUSIVE: a tampered card VERIFIED — the gate is blind');
  console.log('✓ self-test: one flipped card byte → verify correctly FAILED (RED-then-GREEN control)');
  const g = await verifySignature(card);
  if (!g.ok) red(`untampered card failed after self-test: ${g.why}`);
  const jwksErr = checkJwks(g.kid);
  if (jwksErr) red(jwksErr);
  console.log(`✓ agent-card signature valid (kid ${g.kid}; matches /.well-known/jwks.json)`);
  process.exit(0);
}

const r = await verifySignature(card);
if (!r.ok) red(r.why);
const jwksErr = checkJwks(r.kid);
if (jwksErr) red(jwksErr);
console.log(`✓ agent-card signature valid (kid ${r.kid}; matches /.well-known/jwks.json)`);
