#!/usr/bin/env node
// export-scitt.mjs — OCG artifact -> SCITT COSE_Sign1 Signed Statement,
// and verification of a returned COSE Receipt (inclusion-proof walk).
//
// Published-spec status (verified 2026-08-05 at rfc-editor.org, PROV-SCITT-1
// Step 0): SCITT Architecture = RFC 9943, COSE Receipts = RFC 9942. Both are
// published RFCs, not drafts — draft-ietf-scitt-architecture-22 was the
// pre-publication number one earlier sweep still cited; this exporter and
// its comments cite the RFC numbers.
//
// Zero-dep by design (CONTRACT.md — site repo is zero-dep, forever): a
// hand-rolled CBOR (RFC 8949) encoder/decoder subset + COSE_Sign1 (RFC 9052)
// built on Node's WebCrypto (crypto.subtle) — the same runtime primitive
// chaingraph/kernels/_hash.mjs uses for execution_hash. No npm cose/cbor
// package. If this file grows past ~400 lines, PROV-SCITT-1's own row says
// stop and report rather than keep bolting on RFC 9942 receipt-format
// coverage — it is currently under that ceiling.
//
// Scope boundary (PROV-SCITT-1): this is INTEROP CODE for the *published*
// SCITT artifacts. Authoring our own SCITT I-D is a separate queued row
// (MERKLE-PROGRAM) gated on IETF 127 — untouched here.
//
// Usage:
//   node export-scitt.mjs keygen [--alg es256|ed25519] [--out-prefix ./scitt-key]
//   node export-scitt.mjs sign <artifact.json> --key <priv.jwk.json> [--out out.cose]
//   node export-scitt.mjs verify-statement <statement.cose> --pubkey <pub.jwk.json> --payload <artifact.json>
//   node export-scitt.mjs verify-receipt <receipt.cose> <statement.cose>
//   node export-scitt.mjs selftest

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

// ---------------------------------------------------------------------------
// CBOR (RFC 8949) — deterministic/canonical-enough subset: uint, negint,
// bstr, tstr, array, map (sorted by encoded-key bytes), simple(true/false/null),
// and tag (for COSE_Sign1's tag 18). No floats, no indefinite-length items —
// nothing this exporter emits or expects to parse needs them.
// ---------------------------------------------------------------------------

function encodeHead(major, n) {
  n = BigInt(n);
  const m = major << 5;
  if (n < 24n) return Buffer.from([m | Number(n)]);
  if (n < 256n) return Buffer.from([m | 24, Number(n)]);
  if (n < 65536n) { const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(Number(n), 1); return b; }
  if (n < 4294967296n) { const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(Number(n), 1); return b; }
  const b = Buffer.alloc(9); b[0] = m | 27; b.writeBigUInt64BE(n, 1); return b;
}

function cborEncode(value) {
  if (value === false) return Buffer.from([0xf4]);
  if (value === true) return Buffer.from([0xf5]);
  if (value === null || value === undefined) return Buffer.from([0xf6]);
  if (Buffer.isBuffer(value)) return Buffer.concat([encodeHead(2, value.length), value]);
  if (typeof value === 'string') {
    const b = Buffer.from(value, 'utf8');
    return Buffer.concat([encodeHead(3, b.length), b]);
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    const n = BigInt(value);
    return n >= 0n ? encodeHead(0, n) : encodeHead(1, -1n - n);
  }
  if (Array.isArray(value)) {
    const parts = [encodeHead(4, value.length)];
    for (const v of value) parts.push(cborEncode(v));
    return Buffer.concat(parts);
  }
  if (value instanceof Map) {
    const entries = [...value.entries()].map(([k, v]) => [cborEncode(k), cborEncode(v)]);
    entries.sort((a, b) => Buffer.compare(a[0], b[0])); // canonical CBOR: sort by encoded key bytes
    const parts = [encodeHead(5, entries.length)];
    for (const [ek, ev] of entries) parts.push(ek, ev);
    return Buffer.concat(parts);
  }
  if (typeof value === 'object') {
    return cborEncode(new Map(Object.entries(value)));
  }
  throw new Error(`cborEncode: unsupported type ${typeof value}`);
}

function cborEncodeTag(tagNum, inner) {
  return Buffer.concat([encodeHead(6, tagNum), inner]);
}

function cborDecode(buf, off = { i: 0 }) {
  const b0 = buf[off.i++];
  const major = b0 >> 5, ai = b0 & 0x1f;
  const readLen = () => {
    if (ai < 24) return BigInt(ai);
    if (ai === 24) { const v = BigInt(buf[off.i]); off.i += 1; return v; }
    if (ai === 25) { const v = BigInt(buf.readUInt16BE(off.i)); off.i += 2; return v; }
    if (ai === 26) { const v = BigInt(buf.readUInt32BE(off.i)); off.i += 4; return v; }
    if (ai === 27) { const v = buf.readBigUInt64BE(off.i); off.i += 8; return v; }
    throw new Error(`cborDecode: unsupported additional info ${ai}`);
  };
  if (major === 0) return Number(readLen());
  if (major === 1) return -1 - Number(readLen());
  if (major === 2) { const len = Number(readLen()); const v = Buffer.from(buf.subarray(off.i, off.i + len)); off.i += len; return v; }
  if (major === 3) { const len = Number(readLen()); const v = buf.subarray(off.i, off.i + len).toString('utf8'); off.i += len; return v; }
  if (major === 4) { const len = Number(readLen()); const arr = []; for (let k = 0; k < len; k++) arr.push(cborDecode(buf, off)); return arr; }
  if (major === 5) { const len = Number(readLen()); const m = new Map(); for (let k = 0; k < len; k++) { const key = cborDecode(buf, off); const val = cborDecode(buf, off); m.set(key, val); } return m; }
  if (major === 6) { readLen(); return cborDecode(buf, off); } // tag: skip tag number, decode tagged content
  if (major === 7) {
    if (ai === 20) return false;
    if (ai === 21) return true;
    if (ai === 22) return null;
    throw new Error(`cborDecode: unsupported simple value ${ai}`);
  }
  throw new Error(`cborDecode: unsupported major type ${major}`);
}

// ---------------------------------------------------------------------------
// COSE_Sign1 (RFC 9052 §4.2) — header labels: alg=1, content type=3, kid=4,
// cwt-claims=15 (RFC 9597). Alg values: ES256=-7, EdDSA=-8. WebCrypto's
// ECDSA/Ed25519 sign() already returns the raw fixed-length signature COSE
// requires (P1363 r||s for ECDSA) — no re-encoding needed either direction.
// ---------------------------------------------------------------------------

const ALG = { es256: -7, ed25519: -8 };
const SIGN_PARAMS = {
  es256: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
  ed25519: { name: 'Ed25519' },
};

async function generateKeyPair(alg) {
  const params = alg === 'es256'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'Ed25519' };
  return subtle.generateKey(params, true, ['sign', 'verify']);
}

async function signStatement({ artifact, alg, privateKey, issuer }) {
  // Minimal claims per PROV-SCITT-1's row: execution_hash + enough to
  // identify the artifact. The artifact itself stays out of band (detached
  // payload) — a SCITT Signed Statement's payload need not be the whole
  // document, only what the issuer wants a verifier to be able to check.
  const claims = {
    execution_hash: artifact.execution_hash,
    tool_id: artifact.tool_id,
    chaingraph_version: artifact.chaingraph_version,
    generated_at: artifact.generated_at,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8');

  const cwtClaims = new Map([[1, issuer]]); // iss (RFC 8392 CWT claim 1)
  const protectedMap = new Map([
    [1, ALG[alg]],
    [3, 'application/json'],
    [15, cwtClaims],
  ]);
  const protectedBytes = cborEncode(protectedMap);

  const sigStructure = ['Signature1', protectedBytes, Buffer.alloc(0), payload];
  const tbs = cborEncode(sigStructure);
  const signature = Buffer.from(await subtle.sign(SIGN_PARAMS[alg], privateKey, tbs));

  // Detached-payload mode (SO row: "payload = execution_hash + minimal
  // claims; detached-payload mode"): the payload field carries `null`; a
  // verifier must be handed the claims bytes out of band (we ship them
  // alongside for our own verify-statement command, same as a real SCITT
  // registration flow separates statement bytes from the HTTP body).
  const cose = [protectedBytes, new Map(), null, signature];
  return { cose: cborEncodeTag(18, cborEncode(cose)), payload };
}

async function verifyStatement({ coseBytes, payload, publicKey, alg }) {
  const tagged = cborDecode(coseBytes);
  const [protectedBytes, , , signature] = tagged;
  const sigStructure = ['Signature1', protectedBytes, Buffer.alloc(0), payload];
  const tbs = cborEncode(sigStructure);
  return subtle.verify(SIGN_PARAMS[alg], publicKey, signature, tbs);
}

// ---------------------------------------------------------------------------
// COSE Receipts (RFC 9942) inclusion-proof walk. RFC 9942 wraps a Merkle
// verifiable-data-structure proof (RFC 9162 Merkle Tree combining/inclusion
// algorithm) inside a COSE_Sign1's unprotected header. This walker
// implements the RFC 9162 §2.1.3.2 inclusion-proof verification algorithm
// directly against {leaf_hash, leaf_index, tree_size, audit_path[]} —
// independent of which COSE header label a given transparency service uses
// to carry that tuple, since a live service (DataTrails / MS Signing
// Transparency) is FLAG-AND-WAIT (SO #8) and not reachable from this
// offline build environment. Proven here via `selftest`'s self-built tree.
// ---------------------------------------------------------------------------

async function sha256(...parts) {
  const buf = Buffer.concat(parts);
  return Buffer.from(await subtle.digest('SHA-256', buf));
}

async function leafHash(data) { return sha256(Buffer.from([0x00]), data); }
async function nodeHash(left, right) { return sha256(Buffer.from([0x01]), left, right); }

// Builds a full RFC 9162 Merkle tree over `leaves` (raw data buffers) and
// returns { root, proofFor(index) }. Used by selftest to prove the verifier
// below is self-consistent, since no external receipt is reachable offline.
async function buildMerkleTree(leaves) {
  const hashes = await Promise.all(leaves.map(leafHash));
  async function mth(lo, hi) { // MTH over hashes[lo:hi)
    if (hi - lo === 1) return hashes[lo];
    let k = 1; while (k * 2 < hi - lo) k *= 2;
    return nodeHash(await mth(lo, lo + k), await mth(lo + k, hi));
  }
  async function path(index, lo, hi) {
    if (hi - lo === 1) return [];
    let k = 1; while (k * 2 < hi - lo) k *= 2;
    return index < lo + k
      ? [...(await path(index, lo, lo + k)), await mth(lo + k, hi)]
      : [...(await path(index, lo + k, hi)), await mth(lo, lo + k)];
  }
  const root = await mth(0, hashes.length);
  return { root, proofFor: (index) => path(index, 0, hashes.length) };
}

// RFC 9162 §2.1.3.2 audit-path verification, iterative form.
async function verifyInclusion({ leafHash: lh, index, treeSize, auditPath, root }) {
  let fn = index, sn = treeSize - 1;
  let r = lh;
  for (const sibling of auditPath) {
    if (fn % 2 === 1 || fn === sn) {
      // Right child (odd) OR the unpaired rightmost/"boundary" node of an
      // imbalanced level: in both cases this proof element is the LEFT
      // sibling and `r` is the right operand (RFC 9162 MTH always splits
      // D[0:k] | D[k:n], so a boundary orphan is always promoted as the
      // right-hand argument of the combine it eventually joins).
      r = await nodeHash(sibling, r);
      while (fn % 2 === 0 && fn !== 0) { fn = Math.floor(fn / 2); sn = Math.floor(sn / 2); }
    } else {
      r = await nodeHash(r, sibling); // fn even, fn != sn: still consumes this proof element
    }
    fn = Math.floor(fn / 2); sn = Math.floor(sn / 2);
  }
  return sn === 0 && Buffer.compare(r, root) === 0;
}

async function verifyReceiptFile({ receiptBytes, statementBytes }) {
  // A real RFC 9942 receipt: COSE_Sign1 whose unprotected header carries the
  // transparency service's signature over the tree head plus the inclusion
  // proof for this statement. We decode the CBOR envelope and hand the
  // {leaf, index, tree_size, audit_path} tuple to verifyInclusion — the
  // exact unprotected-header label used to reach that tuple varies by
  // service and is filled in against a live receipt once DataTrails/MS
  // registration (FLAG-AND-WAIT, SO #8) is authorized and exercised.
  const receipt = cborDecode(receiptBytes);
  const [, unprotected] = receipt;
  const proof = unprotected instanceof Map ? unprotected.get('inclusion-proof') : undefined;
  if (!proof) throw new Error('verify-receipt: no inclusion-proof entry in unprotected header (expected shape not yet confirmed against a live service — see header comment)');
  const [index, treeSize, auditPath, root] = proof;
  const lh = await leafHash(statementBytes);
  return verifyInclusion({ leafHash: lh, index, treeSize, auditPath, root });
}

// ---------------------------------------------------------------------------
// JWK <-> WebCrypto key helpers (no npm — subtle.importKey/exportKey only).
// ---------------------------------------------------------------------------

async function exportJwk(key) { return subtle.exportKey('jwk', key); }
async function importPrivateJwk(jwk, alg) {
  const params = alg === 'es256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'Ed25519' };
  return subtle.importKey('jwk', jwk, params, true, ['sign']);
}
async function importPublicJwk(jwk, alg) {
  const params = alg === 'es256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'Ed25519' };
  return subtle.importKey('jwk', jwk, params, true, ['verify']);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === 'keygen') {
    const alg = flag(rest, 'alg', 'es256');
    const outPrefix = flag(rest, 'out-prefix', './scitt-key');
    const { publicKey, privateKey } = await generateKeyPair(alg);
    writeFileSync(`${outPrefix}.priv.jwk.json`, JSON.stringify(await exportJwk(privateKey), null, 2));
    writeFileSync(`${outPrefix}.pub.jwk.json`, JSON.stringify(await exportJwk(publicKey), null, 2));
    console.log(`Wrote ${outPrefix}.priv.jwk.json + ${outPrefix}.pub.jwk.json (${alg})`);
    return;
  }

  if (cmd === 'sign') {
    const [artifactPath] = rest;
    const alg = flag(rest, 'alg', 'es256');
    const keyPath = flag(rest, 'key');
    const outPath = flag(rest, 'out', artifactPath.replace(/\.json$/, '.cose'));
    const payloadOutPath = flag(rest, 'payload-out', outPath.replace(/\.cose$/, '.payload.json'));
    if (!artifactPath || !keyPath) throw new Error('usage: sign <artifact.json> --key <priv.jwk.json> [--alg es256|ed25519] [--out out.cose]');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    if (!artifact.execution_hash) throw new Error(`${artifactPath}: not an OCG artifact (no execution_hash)`);
    const privateKey = await importPrivateJwk(JSON.parse(readFileSync(keyPath, 'utf8')), alg);
    const issuer = flag(rest, 'issuer', 'https://ainumbers.co');
    const { cose, payload } = await signStatement({ artifact, alg, privateKey, issuer });
    writeFileSync(outPath, cose);
    writeFileSync(payloadOutPath, payload);
    console.log(`Wrote ${outPath} (${cose.length} bytes, detached payload ${payloadOutPath})`);
    return;
  }

  if (cmd === 'verify-statement') {
    const [statementPath] = rest;
    const alg = flag(rest, 'alg', 'es256');
    const pubkeyPath = flag(rest, 'pubkey');
    const payloadPath = flag(rest, 'payload');
    if (!statementPath || !pubkeyPath || !payloadPath) throw new Error('usage: verify-statement <statement.cose> --pubkey <pub.jwk.json> --payload <payload.json>');
    const publicKey = await importPublicJwk(JSON.parse(readFileSync(pubkeyPath, 'utf8')), alg);
    const ok = await verifyStatement({ coseBytes: readFileSync(statementPath), payload: readFileSync(payloadPath), publicKey, alg });
    console.log(ok ? 'VALID' : 'INVALID');
    process.exit(ok ? 0 : 1);
  }

  if (cmd === 'verify-receipt') {
    const [receiptPath, statementPath] = rest;
    if (!receiptPath || !statementPath) throw new Error('usage: verify-receipt <receipt.cose> <statement.cose>');
    const ok = await verifyReceiptFile({ receiptBytes: readFileSync(receiptPath), statementBytes: readFileSync(statementPath) });
    console.log(ok ? 'VALID' : 'INVALID');
    process.exit(ok ? 0 : 1);
  }

  if (cmd === 'selftest') {
    let failures = 0;
    for (const alg of ['es256', 'ed25519']) {
      const { publicKey, privateKey } = await generateKeyPair(alg);
      const artifact = { execution_hash: 'a'.repeat(64), tool_id: 'selftest-tool', chaingraph_version: '0.4.0', generated_at: new Date(0).toISOString() };
      const { cose, payload } = await signStatement({ artifact, alg, privateKey, issuer: 'https://ainumbers.co' });
      const ok = await verifyStatement({ coseBytes: cose, payload, publicKey, alg });
      const tampered = await verifyStatement({ coseBytes: cose, payload: Buffer.from('{"execution_hash":"tampered"}'), publicKey, alg });
      console.log(`[${alg}] COSE_Sign1 round-trip: ${ok ? 'PASS' : 'FAIL'}; tamper rejected: ${!tampered ? 'PASS' : 'FAIL'}`);
      if (!ok || tampered) failures++;
    }
    {
      const leaves = Array.from({ length: 7 }, (_, i) => Buffer.from(`leaf-${i}`));
      const { root, proofFor } = await buildMerkleTree(leaves);
      let treeOk = true;
      for (let i = 0; i < leaves.length; i++) {
        const lh = await leafHash(leaves[i]);
        const auditPath = await proofFor(i);
        const ok = await verifyInclusion({ leafHash: lh, index: i, treeSize: leaves.length, auditPath, root });
        if (!ok) treeOk = false;
      }
      const badOk = await verifyInclusion({ leafHash: await leafHash(Buffer.from('not-a-leaf')), index: 0, treeSize: leaves.length, auditPath: await proofFor(0), root });
      console.log(`[merkle] RFC 9162 inclusion-proof walk (7 leaves, all indices): ${treeOk ? 'PASS' : 'FAIL'}; tampered leaf rejected: ${!badOk ? 'PASS' : 'FAIL'}`);
      if (!treeOk || badOk) failures++;
    }
    console.log(failures === 0 ? '\nselftest: ALL PASS' : `\nselftest: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.error('usage: export-scitt.mjs <keygen|sign|verify-statement|verify-receipt|selftest> ...');
  process.exit(2);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
