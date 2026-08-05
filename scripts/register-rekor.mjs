#!/usr/bin/env node
// register-rekor.mjs — Lane A of PROV-SCITT-REGISTER-1: register a signed OCG
// batch root (a §20.1 Merkle root, or a §HEAD-1 head_hash) with the Sigstore
// Rekor public transparency log, and verify the returned proof OFFLINE.
//
// Why Rekor (Tim's ruling 2026-08-05): DataTrails is currently unavailable,
// Microsoft Signing Transparency has no public submission endpoint, and
// self-hosted ledgers (scitt-ccf-ledger/immudb/Trillian) are self-attestation
// and fail SO #0 SURVIVES-THE-MAINTAINER. rekor.sigstore.dev is accountless,
// free, OpenSSF-backed, ~5 years in production — the strongest survivability
// of any option on the table.
//
// Zero-dep (CONTRACT.md — site repo is zero-dep, forever): hand-rolled HTTP
// via Node's built-in fetch, WebCrypto for ECDSA P-256, and a from-scratch
// RFC 9162 (RFC 6962) Merkle inclusion-proof walk — the SAME leafHash/
// nodeHash/audit-path algorithm as scripts/export-scitt.mjs's verifier, but
// NOT a fork of its COSE logic (Lane A does not use COSE/CBOR at all — Rekor
// v1's hashedrekord entry type is plain JSON).
//
// CHAINPOINT GUARD (SO #0, absolute): `verify` below NEVER calls Rekor. Every
// byte it needs — the log entry body, the inclusion proof, the checkpoint —
// was fetched once at registration time and is stored in the record file.
// The only thing pinned in this script is Rekor's log public key (below),
// used to check the checkpoint's own signature; if that key is ever rotated,
// verification of OLD records still works (the record's own inclusion proof
// is self-contained) but NEW checkpoints would need a key update here.
//
// Entry-type note (row asks to "pick whichever the API proves out cleanest,
// record which"): Ed25519 hashedrekord entries were tried first and rejected
// server-side ("unsupported hash algorithm" / "invalid signature" — Rekor's
// ed25519 hashedrekord path expects conventions this exporter could not
// reproduce from the public API alone). ECDSA P-256 hashedrekord entries
// work cleanly and are what this script uses.
//
// Usage:
//   node register-rekor.mjs keygen [--out-prefix ./rekor-key]
//   node register-rekor.mjs register --hash sha256:<hex> --key <priv.jwk.json> [--out record.json]
//   node register-rekor.mjs merkle-root <hashes.txt>          # one "sha256:<hex>" per line -> prints root
//   node register-rekor.mjs verify <record.json>               # OFFLINE — never calls Rekor
//   node register-rekor.mjs selftest                            # local-only, no network

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const REKOR_URL = 'https://rekor.sigstore.dev';

// Pinned Rekor log public key (fetched + logID-cross-checked 2026-08-05):
// sha256(DER) of this key == c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d,
// which matches the `logID` field on every entry this script has registered
// against the active `rekor.sigstore.dev` tree (treeID 1193050959916656506).
// Pinned so `verify` needs zero network access — re-derive by fetching
// GET https://rekor.sigstore.dev/api/v1/log/publicKey if it is ever rotated.
const REKOR_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2G2Y+2tabdTV5BcGiBIx0a9fAFwr
kBbmLSGtks4L3qX6yYY0zufBnhC8Ur/iy55GhWP/9A/bY2LhC30M9+RYtw==
-----END PUBLIC KEY-----
`;
const REKOR_LOG_ID = 'c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d';

// ---------------------------------------------------------------------------
// RFC 9162 (RFC 6962) Merkle primitives — mirrors export-scitt.mjs's verifier
// algorithm (leafHash = sha256(0x00||data), nodeHash = sha256(0x01||l||r),
// same audit-path combine logic) so both files agree on tree semantics
// without importing each other (fence keeps this file self-contained).
// ---------------------------------------------------------------------------

async function sha256(...parts) { return Buffer.from(await subtle.digest('SHA-256', Buffer.concat(parts))); }
async function leafHash(data) { return sha256(Buffer.from([0x00]), data); }
async function nodeHash(l, r) { return sha256(Buffer.from([0x01]), l, r); }

async function buildMerkleTree(leaves) {
  const hashes = await Promise.all(leaves.map(leafHash));
  async function mth(lo, hi) {
    if (hi - lo === 1) return hashes[lo];
    let k = 1; while (k * 2 < hi - lo) k *= 2;
    return nodeHash(await mth(lo, lo + k), await mth(lo + k, hi));
  }
  const root = await mth(0, hashes.length);
  return { root, size: hashes.length };
}

// RFC 9162 §2.1.3.2 audit-path verification, iterative form.
async function verifyInclusion({ leafHash: lh, index, treeSize, auditPath, root }) {
  let fn = index, sn = treeSize - 1;
  let r = lh;
  for (const sibling of auditPath) {
    if (fn % 2 === 1 || fn === sn) {
      r = await nodeHash(sibling, r);
      while (fn % 2 === 0 && fn !== 0) { fn = Math.floor(fn / 2); sn = Math.floor(sn / 2); }
    } else {
      r = await nodeHash(r, sibling);
    }
    fn = Math.floor(fn / 2); sn = Math.floor(sn / 2);
  }
  return sn === 0 && Buffer.compare(r, root) === 0;
}

// ---------------------------------------------------------------------------
// C2SP tlog-checkpoint (signed note) verification — origin/size/root lines +
// a "— <name> <base64(4-byte keyID hint || DER signature)>" cosignature line.
// Pinned to tlog-checkpoint/v1.0.0 semantics (SPEC.md §20.2 attribution).
// ---------------------------------------------------------------------------

function derToP1363(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('checkpoint sig: not a DER SEQUENCE');
  let len = der[i++];
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = (len << 8) | der[i++]; }
  if (der[i++] !== 0x02) throw new Error('checkpoint sig: missing r INTEGER');
  let rLen = der[i++]; let r = Buffer.from(der.subarray(i, i + rLen)); i += rLen;
  if (der[i++] !== 0x02) throw new Error('checkpoint sig: missing s INTEGER');
  let sLen = der[i++]; let s = Buffer.from(der.subarray(i, i + sLen)); i += sLen;
  const fix = (b) => { while (b.length > 32 && b[0] === 0) b = b.subarray(1); const out = Buffer.alloc(32); b.copy(out, 32 - b.length); return out; };
  return Buffer.concat([fix(r), fix(s)]);
}

function rekorSpkiDer() {
  const b64 = REKOR_PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s+/g, '');
  return Buffer.from(b64, 'base64');
}

async function verifyCheckpoint(checkpointText, expectedRootHex) {
  const lines = checkpointText.split('\n');
  const origin = lines[0];
  const treeSize = Number(lines[1]);
  const rootB64 = lines[2];
  const rootHex = Buffer.from(rootB64, 'base64').toString('hex');
  const cosigLine = lines.find((l) => l.startsWith('— ')); // U+2014 EM DASH, per C2SP note format
  if (!cosigLine) throw new Error('checkpoint: no cosignature line found');
  const sigB64 = cosigLine.split(' ').pop();
  const sigRaw = Buffer.from(sigB64, 'base64');
  const keyIdHint = sigRaw.subarray(0, 4).toString('hex');
  const sigDer = sigRaw.subarray(4);

  const der = rekorSpkiDer();
  const keyHash = (await sha256(der)).toString('hex');
  if (keyHash !== REKOR_LOG_ID) throw new Error(`pinned Rekor key mismatch: expected logID ${REKOR_LOG_ID}, pinned key hashes to ${keyHash}`);
  if (!keyHash.startsWith(keyIdHint)) throw new Error(`checkpoint cosignature key-id hint ${keyIdHint} does not match pinned key ${keyHash.slice(0, 8)}`);

  const noteText = lines.slice(0, 3).join('\n') + '\n';
  const pub = await subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  const sigOk = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, derToP1363(sigDer), Buffer.from(noteText, 'utf8'));

  const rootMatches = expectedRootHex === undefined || rootHex === expectedRootHex;
  return { origin, treeSize, rootHex, sigOk, rootMatches };
}

// ---------------------------------------------------------------------------
// ECDSA P-256 key helpers (JWK <-> WebCrypto; no npm).
// ---------------------------------------------------------------------------

async function generateKeyPair() { return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); }
async function importPrivateJwk(jwk) { return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']); }
async function exportSpkiPem(publicKey) {
  const der = Buffer.from(await subtle.exportKey('spki', publicKey));
  return `-----BEGIN PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
}

// ---------------------------------------------------------------------------
// Rekor submission (hashedrekord, ECDSA P-256). The "artifact" whose hash
// Rekor indexes is the UTF-8 bytes of the anchored value string itself
// (e.g. "sha256:<hex>" — a §20.1 batch root or a §HEAD-1 head_hash). Signing
// that string with ECDSA/SHA-256 produces exactly the digest Rekor stores as
// data.hash.value, so no second hash/no double-hash bug — proven against the
// live API 2026-08-05 (see PROV-SCITT-REGISTER-1 check-off for the run).
// ---------------------------------------------------------------------------

async function submitHashedRekord({ anchoredHash, privateKey, publicKey }) {
  const artifactBytes = Buffer.from(anchoredHash, 'utf8');
  const digest = await sha256(artifactBytes);
  const signature = Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, artifactBytes));
  const pem = await exportSpkiPem(publicKey);

  const body = {
    apiVersion: '0.0.1',
    kind: 'hashedrekord',
    spec: {
      data: { hash: { algorithm: 'sha256', value: digest.toString('hex') } },
      signature: { content: signature.toString('base64'), publicKey: { content: Buffer.from(pem, 'utf8').toString('base64') } },
    },
  };

  const res = await fetch(`${REKOR_URL}/api/v1/log/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status !== 201) throw new Error(`rekor submit failed: HTTP ${res.status}: ${text}`);
  const json = JSON.parse(text);
  const uuid = Object.keys(json)[0];
  return { uuid, entry: json[uuid] };
}

// ---------------------------------------------------------------------------
// Offline verification of a saved record — the Chainpoint guard: no fetch()
// call anywhere in this function or anything it calls.
// ---------------------------------------------------------------------------

async function verifyRecordOffline(record) {
  const bodyBytes = Buffer.from(record.body_b64, 'base64');
  const bodyJson = JSON.parse(bodyBytes.toString('utf8'));
  const results = {};

  // 1. the entry actually commits to our anchored_hash: recompute
  //    sha256(anchored_hash string) and compare to the entry's own hash.value.
  const recomputedDigest = (await sha256(Buffer.from(record.anchored_hash, 'utf8'))).toString('hex');
  results.digestMatchesAnchoredHash = recomputedDigest === bodyJson.spec.data.hash.value;

  // 2. RFC 6962 inclusion proof: leaf = sha256(0x00 || bodyBytes), walk to root.
  const lh = await leafHash(bodyBytes);
  const auditPath = record.inclusionProof.hashes.map((h) => Buffer.from(h, 'hex'));
  const root = Buffer.from(record.inclusionProof.rootHash, 'hex');
  results.inclusionProofValid = await verifyInclusion({
    leafHash: lh, index: record.inclusionProof.logIndex, treeSize: record.inclusionProof.treeSize, auditPath, root,
  });

  // 3. checkpoint: root matches the inclusion proof's root, and the
  //    checkpoint's own cosignature verifies against the PINNED Rekor key.
  const cp = await verifyCheckpoint(record.inclusionProof.checkpoint, record.inclusionProof.rootHash);
  results.checkpointRootMatches = cp.rootMatches;
  results.checkpointSignatureValid = cp.sigOk;

  results.ALL_PASS = results.digestMatchesAnchoredHash && results.inclusionProofValid && results.checkpointRootMatches && results.checkpointSignatureValid;
  return results;
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
    const outPrefix = flag(rest, 'out-prefix', './rekor-key');
    const { publicKey, privateKey } = await generateKeyPair();
    writeFileSync(`${outPrefix}.priv.jwk.json`, JSON.stringify(await subtle.exportKey('jwk', privateKey), null, 2));
    writeFileSync(`${outPrefix}.pub.jwk.json`, JSON.stringify(await subtle.exportKey('jwk', publicKey), null, 2));
    console.log(`Wrote ${outPrefix}.priv.jwk.json + ${outPrefix}.pub.jwk.json (ECDSA P-256)`);
    return;
  }

  if (cmd === 'merkle-root') {
    const [hashesPath] = rest;
    if (!hashesPath) throw new Error('usage: merkle-root <hashes.txt>  (one "sha256:<hex>" per line)');
    const lines = readFileSync(hashesPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const leaves = lines.map((l) => Buffer.from(l, 'utf8'));
    const { root, size } = await buildMerkleTree(leaves);
    console.log(`sha256:${root.toString('hex')}  (${size} leaves)`);
    return;
  }

  if (cmd === 'register') {
    const anchoredHash = flag(rest, 'hash');
    const keyPath = flag(rest, 'key');
    const outPath = flag(rest, 'out', 'rekor-record.json');
    if (!anchoredHash || !keyPath) throw new Error('usage: register --hash sha256:<hex> --key <priv.jwk.json> [--out record.json]');
    if (!/^sha256:[a-f0-9]{64}$/.test(anchoredHash)) throw new Error(`--hash must be "sha256:<64-hex>", got: ${anchoredHash}`);
    const jwk = JSON.parse(readFileSync(keyPath, 'utf8'));
    const privateKey = await importPrivateJwk(jwk);
    const pubJwk = { ...jwk, d: undefined, key_ops: ['verify'] };
    const publicKey = await subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);

    const { uuid, entry } = await submitHashedRekord({ anchoredHash, privateKey, publicKey });
    const record = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_origin: REKOR_URL,
      anchored_hash: anchoredHash,
      uuid,
      body_b64: entry.body,
      logID: entry.logID,
      inclusionProof: entry.verification.inclusionProof,
      signedEntryTimestamp: entry.verification.signedEntryTimestamp,
    };
    writeFileSync(outPath, JSON.stringify(record, null, 2));
    console.log(`Registered ${anchoredHash} -> Rekor uuid ${uuid}, wrote ${outPath}`);
    return;
  }

  if (cmd === 'verify') {
    const [recordPath] = rest;
    if (!recordPath) throw new Error('usage: verify <record.json>');
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    const results = await verifyRecordOffline(record);
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.ALL_PASS ? 0 : 1);
  }

  if (cmd === 'selftest') {
    // Local-only: builds a tree, checks inclusion, tamper-rejects. No network.
    let failures = 0;
    const leaves = Array.from({ length: 8 }, (_, i) => Buffer.from(`sha256:${'0'.repeat(63)}${i}`, 'utf8'));
    const hashes = await Promise.all(leaves.map(leafHash));
    async function mth(lo, hi) { if (hi - lo === 1) return hashes[lo]; let k = 1; while (k * 2 < hi - lo) k *= 2; return nodeHash(await mth(lo, lo + k), await mth(lo + k, hi)); }
    async function path(index, lo, hi) { if (hi - lo === 1) return []; let k = 1; while (k * 2 < hi - lo) k *= 2; return index < lo + k ? [...(await path(index, lo, lo + k)), await mth(lo + k, hi)] : [...(await path(index, lo + k, hi)), await mth(lo, lo + k)]; }
    const root = await mth(0, leaves.length);
    for (let i = 0; i < leaves.length; i++) {
      const ok = await verifyInclusion({ leafHash: hashes[i], index: i, treeSize: leaves.length, auditPath: await path(i, 0, leaves.length), root });
      if (!ok) failures++;
    }
    const badOk = await verifyInclusion({ leafHash: await leafHash(Buffer.from('tampered')), index: 0, treeSize: leaves.length, auditPath: await path(0, 0, leaves.length), root });
    console.log(`[merkle] 8-leaf inclusion, all indices: ${failures === 0 ? 'PASS' : 'FAIL'}; tampered leaf rejected: ${!badOk ? 'PASS' : 'FAIL'}`);
    if (badOk) failures++;
    console.log(failures === 0 ? 'selftest: ALL PASS' : `selftest: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.error('usage: register-rekor.mjs <keygen|merkle-root|register|verify|selftest> ...');
  process.exit(2);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
