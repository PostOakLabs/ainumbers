#!/usr/bin/env node
/**
 * scripts/sign-agent-card.mjs — A2A-CARD-SIGN-1 (AGENT-REACH-BUILD-SPEC §3.8)
 *
 * Signs /.well-known/agent-card.json as an A2A 1.0 Signed Agent Card: a DETACHED
 * JWS (RFC 7515, alg EdDSA) over the JCS-canonicalised card (RFC 8785 — the same
 * canon as cgCanon in chaingraph/kernels/_hash.mjs), stored in the card's
 * signatures[] member:
 *
 *   "signatures": [ { "protected": "<b64url header JSON>", "signature": "<b64url sig>" } ]
 *
 * The signing input is `<protected>.<b64url(JCS(card minus signatures))>` — the
 * payload is detached (the card itself is the payload, per the A2A Signed Agent
 * Card profile).
 *
 * KEY LAW (⛔ read before editing): the signing key is the estate's EXISTING §16
 * signer — the worker's key.pem (mcp-apps-poc/key.pem, the same PKCS#8 Ed25519
 * key the audit_signature path derives its identity from). NEVER a new key,
 * NEVER a key inside the site repo, and NEVER any key material in a commit, log,
 * or PR body — this script quotes only the key PATH.
 *
 * `kid` = the §16 key fingerprint: the did:key (z6Mk…) form of the raw public
 * key, via chaingraph/kernels/_proof.mjs's rawPubkeyToDidKey convention.
 *
 * ⛔ NOT a derived artifact: signing needs the private key, which never lives on
 * the main-regen runner. The signed card is committed by the row that ran this
 * script (single writer = this script, run locally); scripts/check-agent-card-
 * sig.mjs in preflight guards drift — any later card edit without a local
 * re-sign goes RED. See the EXCLUDED entry in scripts/derived-artifacts.mjs.
 *
 * Usage:
 *   node scripts/sign-agent-card.mjs                       # sign in place
 *   node scripts/sign-agent-card.mjs --key <path-to-pem>   # explicit key path
 *   A2A_CARD_KEY_PATH=<path> node scripts/sign-agent-card.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateKey } from 'node:crypto';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';
import { rawPubkeyToDidKey } from '../chaingraph/kernels/_proof.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CARD = resolve(REPO, '.well-known', 'agent-card.json');

// Key path resolution order: --key flag > A2A_CARD_KEY_PATH env > the worker's
// key.pem at the workspace sibling mcp-apps-poc/ (never inside the site repo).
// The default candidate list covers both checkouts (repo/ and repo/.wt/<row>/).
const keyFlagIdx = process.argv.indexOf('--key');
const keyCandidates = [
  resolve(REPO, '..', 'mcp-apps-poc', 'key.pem'),
  resolve(REPO, '..', '..', 'mcp-apps-poc', 'key.pem'),
  resolve(REPO, '..', '..', '..', 'mcp-apps-poc', 'key.pem'),
];
const KEY_PATH = resolve(
  process.cwd(),
  keyFlagIdx > -1 ? process.argv[keyFlagIdx + 1]
  : process.env.A2A_CARD_KEY_PATH
    ? process.env.A2A_CARD_KEY_PATH
    : keyCandidates.find((p) => existsSync(p)) ?? keyCandidates[0],
);

function fail(msg) {
  console.error(`sign-agent-card: ${msg}`);
  process.exit(1);
}

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const enc = (s) => new TextEncoder().encode(s);

if (!existsSync(KEY_PATH)) fail(`signing key not found at ${KEY_PATH} (path only — contents are never read into output)`);

// ── load card, strip any existing signatures ──────────────────────────────────
const card = JSON.parse(readFileSync(CARD, 'utf8'));
if (!card.protocolVersion) fail('card has no protocolVersion — not an A2A agent card?');
delete card.signatures; // a re-sign replaces any prior signature; canon input never includes it

// ── JCS canonical bytes (RFC 8785) — identical canon to the §16 proof path ────
const canon = enc(JSON.stringify(cgCanon(card)));

// ── import the PKCS#8 Ed25519 key into WebCrypto; derive kid from the raw pub ─
const pem = readFileSync(KEY_PATH, 'utf8');
const nodeKey = createPrivateKey(pem); // validates the PEM; der never printed
const der = nodeKey.export({ format: 'der', type: 'pkcs8' });
const privKey = await globalThis.crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
const pubJwk = await globalThis.crypto.subtle.exportKey('jwk', privKey); // x = raw public key
const pubKey = await globalThis.crypto.subtle.importKey(
  'jwk', { kty: 'OKP', crv: 'Ed25519', x: pubJwk.x }, { name: 'Ed25519' }, true, ['verify'],
);
const kid = await rawPubkeyToDidKey(pubKey); // did:key:z… — the §16 fingerprint convention

// ── detached JWS over the canonical card ──────────────────────────────────────
const protectedHeader = { alg: 'EdDSA', kid, typ: 'JOSE' };
const protectedB64 = b64u(enc(JSON.stringify(protectedHeader)));
const signingInput = enc(`${protectedB64}.${b64u(canon)}`);
const sig = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privKey, signingInput));

card.signatures = [{ protected: protectedB64, signature: b64u(sig) }];

// ⛔ Fence: signatures[] member ONLY. The card is committed prose — a whole-file
// JSON.stringify rewrite would reformat compact arrays and touch every line, so
// the signature block is spliced in TEXTUALLY, leaving every other byte as authored.
let raw = readFileSync(CARD, 'utf8').replace(/[\s]*$/, '');
if (!raw.endsWith('}')) fail('card file does not end with } — refusing a textual splice');
// strip a previous signatures member (this writer's own known block shape)
raw = raw.replace(/,\n  "signatures": \[\{[\s\S]*?\n  \]\n\}$/, '\n}');
if (raw.includes('"signatures"')) fail('unexpected pre-existing signatures member shape — manual review needed');
const sigBlock = JSON.stringify(card.signatures, null, 2).replace(/\n/g, '\n  ');
const spliced = raw.slice(0, -1).replace(/\s*$/, '') + ',\n  "signatures": ' + sigBlock + '\n}\n';
JSON.parse(spliced); // splice must still be valid JSON — prove it before writing
writeFileSync(CARD, spliced);
console.log(`✓ signed .well-known/agent-card.json (detached JWS, EdDSA over JCS)`);
console.log(`  kid: ${kid}`);
console.log(`  key: ${KEY_PATH} (path only; no key material emitted)`);
