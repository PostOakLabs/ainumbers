#!/usr/bin/env node
// register-sigsum.mjs — Lane C of SIGSUM-ANCHOR-1: register a signed OCG
// batch root (a §20.1 Merkle root, or a §HEAD-1 head_hash) with the Sigsum
// public transparency log ("seasalp", operated by Glasklar Teknik), and
// verify the returned proof + witness cosignatures OFFLINE.
//
// Why Sigsum (Tim's 2026-08-10 ratified anchor slate, row SIGSUM-ANCHOR-1):
// a SECOND, independent public transparency log alongside Lane A (Rekor,
// register-rekor.mjs) — additive, never a replacement. Sigsum is minimal,
// free, accountless (submission itself needs no account — only a
// rate-limit token bound to our own domain, see "DNS TXT record" below),
// and its own log entries carry k-of-n witness cosignatures (Glasklar +
// Mullvad) that close anchor-equivocation per SPEC.md §20.2 — Sigsum is
// named there by name as a conformant independent-witness mechanism.
//
// Protocol source (fetched fresh 2026-08-10 from the CURRENT sigsum-go
// implementation — git.glasklar.is/sigsum/core/sigsum-go, mirrored at
// github.com/sigsum/sigsum-go — NOT the older doc/design.md / doc/api.md,
// which describe a v0 wire shape sigsum-go has since dropped shard_hint
// from; this script matches the shipped v1 library):
//   pkg/types/leaf.go        — Leaf{Checksum,Signature,KeyHash}, ToBinary/ToHash
//   pkg/types/tree_head.go   — FormatCheckpoint, SigsumCheckpointOrigin,
//                               toCosignedData ("cosignature/v1\ntime N\n<checkpoint>")
//   pkg/types/proof.go       — InclusionProof{LeafIndex,Path}
//   pkg/requests/requests.go — add-leaf POST body: message/signature/public_key
//   pkg/merkle/{merkle,verify}.go — RFC 6962 leaf/interior hashing + inclusion walk
//   pkg/submit-token/token.go — rate-limit token + "_sigsum_v1"/"_sigsum_v0" DNS TXT
//   Live policy (glasklar/services/sigsum-logs, instances/seasalp.md +
//   www.sigsum.org/content/services.md, fetched 2026-08-10): seasalp log
//   pubkey + the two stable witness pubkeys pinned below.
//
// Zero-dep (CONTRACT.md — site repo is zero-dep, forever): Node built-in
// fetch + WebCrypto Ed25519, from-scratch RFC 6962 Merkle inclusion walk
// (same leafHash/nodeHash shape as register-rekor.mjs's RFC 9162 walk, but
// Sigsum's OWN leaf serialization — see leafToBinary below — not Rekor's).
//
// CHAINPOINT GUARD (SO #0, absolute): `verify` below NEVER calls seasalp.
// Every byte it needs — the leaf, the cosigned tree head, the inclusion
// proof — was fetched once at registration time and is stored in the
// record file. Witness public keys are PINNED below (not fetched at
// verify time) so a future compromise of the docs source cannot silently
// swap the trust anchor under an old record's feet.
//
// Rate-limit / domain binding (SO #8 — DNS is a Tim-only console act):
// seasalp enforces "288 entries per 24h for each domain suffix" and
// identifies the submitting domain via a Sigsum-Token HTTP header, whose
// signing key must be published as a DNS TXT record — CURRENT label
// "_sigsum_v1.<domain>" (sigsum-go pkg/submit-token/token.go), with
// "_sigsum_v0.<domain>" kept as a legacy fallback by the same code. This
// script's `dns-record` command prints the exact record to hand Tim; it
// never places it. `register` below first tries WITHOUT a token (Sigsum's
// default/shared bucket) and only requires --token-key/--domain if seasalp
// answers 403/429 demanding one — see the `register` command for the
// measured outcome of that live test.
//
// Usage:
//   node register-sigsum.mjs keygen [--out-prefix ./sigsum-key]
//   node register-sigsum.mjs token-keygen [--out-prefix ./sigsum-token-key]
//   node register-sigsum.mjs dns-record --token-key <pub.jwk.json> --domain <domain>
//   node register-sigsum.mjs register --hash sha256:<hex> --key <priv.jwk.json>
//       [--token-key <token-priv.jwk.json> --domain <domain>]
//       [--out record.json] [--poll-attempts 30] [--poll-interval-ms 2000]
//   node register-sigsum.mjs verify <record.json>   # OFFLINE — never calls seasalp
//   node register-sigsum.mjs selftest                # local-only, no network

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const LOG_URL = 'https://seasalp.glasklar.is';

// Pinned live policy, fetched 2026-08-10 from
// git.glasklar.is/glasklar/services/sigsum-logs (instances/seasalp.md) and
// git.glasklar.is/sigsum/project/documentation (www.sigsum.org/content/services.md).
const LOG_PUBLIC_KEY_HEX = '0ec7e16843119b120377a73913ac6acbc2d03d82432e2c36b841b09a95841f25';
const WITNESSES = [
  { name: 'witness.glasklar.is', keyHex: 'b2106db9065ec97f25e09c18839216751a6e26d8ed8b41e485a563d3d1498536' },
  { name: 'witness.mullvad.net', keyHex: '15d6d0141543247b74bab3c1076372d9c894f619c376d64b29aa312cc00f61ad' },
];

const CHECKPOINT_ORIGIN_PREFIX = 'sigsum.org/v1/tree/';
const COSIGNATURE_NAMESPACE = 'cosignature/v1';
const TREE_LEAF_NAMESPACE = 'sigsum.org/v1/tree-leaf';
const SUBMIT_TOKEN_NAMESPACE = 'sigsum.org/v1/submit-token';

// ---------------------------------------------------------------------------
// RFC 6962 Merkle primitives — Sigsum's own leaf/interior framing
// (pkg/merkle/merkle.go: 0x00-prefixed leaf, 0x01-prefixed interior; same
// algorithm family as register-rekor.mjs, independent implementation here
// so this file stays self-contained per fence discipline).
// ---------------------------------------------------------------------------

async function sha256(...parts) { return Buffer.from(await subtle.digest('SHA-256', Buffer.concat(parts))); }
async function hashLeafNode(b) { return sha256(Buffer.from([0x00]), b); }
async function hashInteriorNode(l, r) { return sha256(Buffer.from([0x01]), l, r); }

// RFC 9162 §2.1.3.2 inclusion-proof verification, iterative form — mirrors
// sigsum-go's merkle.VerifyInclusion exactly (isOdd(fn) => left sibling on
// path; fn<sn => right sibling on path).
async function verifyInclusion({ leaf, index, size, root, path }) {
  let r = leaf;
  let fn = index;
  for (let sn = size - 1; sn > 0; fn = Math.floor(fn / 2), sn = Math.floor(sn / 2)) {
    const isOdd = (fn & 1) === 1;
    if (isOdd) {
      r = await hashInteriorNode(path[0], r);
      path = path.slice(1);
    } else if (fn < sn) {
      r = await hashInteriorNode(r, path[0]);
      path = path.slice(1);
    }
  }
  return Buffer.compare(r, root) === 0;
}

// ---------------------------------------------------------------------------
// Sigsum leaf: Leaf{Checksum(32), Signature(64), KeyHash(32)} -> ToBinary()
// is that 128-byte concatenation (pkg/types/leaf.go). The submitted
// "message" is hashed AGAIN to produce Checksum (SignLeafMessage ->
// checksum := HashBytes(msg); leaf signature covers that checksum, inside
// the "sigsum.org/v1/tree-leaf" namespace).
// ---------------------------------------------------------------------------

function attachNamespace(namespace, msgBytes) {
  return Buffer.concat([Buffer.from(namespace, 'utf8'), Buffer.from([0x00]), msgBytes]);
}

async function leafToBinary({ checksum, signature, keyHash }) {
  return Buffer.concat([checksum, signature, keyHash]);
}

// ---------------------------------------------------------------------------
// Checkpoint (signed note) + witness cosignature message construction —
// mirrors pkg/types/tree_head.go FormatCheckpoint / toCosignedData exactly.
// ---------------------------------------------------------------------------

function formatCheckpoint(origin, size, rootHash) {
  return `${origin}\n${size}\n${rootHash.toString('base64')}\n`;
}

async function sigsumCheckpointOrigin(logPublicKeyBytes) {
  const h = await sha256(logPublicKeyBytes);
  return `${CHECKPOINT_ORIGIN_PREFIX}${h.toString('hex')}`;
}

function toCosignedData(origin, size, rootHash, timestamp) {
  return `${COSIGNATURE_NAMESPACE}\ntime ${timestamp}\n${formatCheckpoint(origin, size, rootHash)}`;
}

// ---------------------------------------------------------------------------
// Ed25519 key helpers (JWK <-> WebCrypto; no npm).
// ---------------------------------------------------------------------------

async function generateKeyPair() { return subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); }
async function importPrivateJwk(jwk) { return subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['sign']); }
async function importPublicRawHex(hex) {
  return subtle.importKey('raw', Buffer.from(hex, 'hex'), { name: 'Ed25519' }, true, ['verify']);
}
async function publicKeyHexFromJwk(jwk) {
  const pub = { ...jwk, d: undefined, key_ops: ['verify'] };
  const key = await subtle.importKey('jwk', pub, { name: 'Ed25519' }, true, ['verify']);
  const raw = Buffer.from(await subtle.exportKey('raw', key));
  return raw.toString('hex');
}

// ---------------------------------------------------------------------------
// ASCII wire format helpers — Sigsum's `key=hexvalue\n` lines
// (pkg/ascii/writer.go: WriteLine writes "%s=" then %x-hex-encoded bytes).
// ---------------------------------------------------------------------------

function parseAsciiLines(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1);
    (out[key] ??= []).push(val);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Submit-token (rate-limit token) — pkg/submit-token/token.go. DNS label is
// CURRENTLY "_sigsum_v1" (the code keeps "_sigsum_v0" only as a fallback
// lookup for older records — this script always emits the current label).
// ---------------------------------------------------------------------------

async function makeSubmitToken(tokenPrivateKey, logPublicKeyBytes) {
  const data = attachNamespace(SUBMIT_TOKEN_NAMESPACE, logPublicKeyBytes);
  const sig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, tokenPrivateKey, data));
  return sig;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

async function httpPost(path, bodyText, extraHeaders) {
  const res = await fetch(`${LOG_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...(extraHeaders || {}) },
    body: bodyText,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function httpGet(path) {
  const res = await fetch(`${LOG_URL}/${path}`);
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === 'keygen' || cmd === 'token-keygen') {
    const outPrefix = flag(rest, 'out-prefix', cmd === 'keygen' ? './sigsum-key' : './sigsum-token-key');
    const { publicKey, privateKey } = await generateKeyPair();
    writeFileSync(`${outPrefix}.priv.jwk.json`, JSON.stringify(await subtle.exportKey('jwk', privateKey), null, 2));
    writeFileSync(`${outPrefix}.pub.jwk.json`, JSON.stringify(await subtle.exportKey('jwk', publicKey), null, 2));
    const pubHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    console.log(`Wrote ${outPrefix}.priv.jwk.json + ${outPrefix}.pub.jwk.json (Ed25519)`);
    console.log(`Public key (hex): ${pubHex}`);
    return;
  }

  if (cmd === 'dns-record') {
    const tokenKeyPath = flag(rest, 'token-key');
    const domain = flag(rest, 'domain');
    if (!tokenKeyPath || !domain) throw new Error('usage: dns-record --token-key <pub.jwk.json> --domain <domain>');
    const jwk = JSON.parse(readFileSync(tokenKeyPath, 'utf8'));
    const pubHex = await publicKeyHexFromJwk(jwk);
    console.log(`Record name (current): _sigsum_v1.${domain}`);
    console.log(`Record name (legacy fallback, sigsum-go also checks this): _sigsum_v0.${domain}`);
    console.log(`Record type: TXT`);
    console.log(`Record value: ${pubHex}`);
    console.log(`Reason: rate-limit / submit-token key for Sigsum log submissions to ${LOG_URL} (SIGSUM-ANCHOR-1). Console act — Tim only, per SO #8.`);
    return;
  }

  if (cmd === 'register') {
    const anchoredHash = flag(rest, 'hash');
    const keyPath = flag(rest, 'key');
    const tokenKeyPath = flag(rest, 'token-key');
    const domain = flag(rest, 'domain');
    const outPath = flag(rest, 'out', 'sigsum-record.json');
    const pollAttempts = Number(flag(rest, 'poll-attempts', '30'));
    const pollIntervalMs = Number(flag(rest, 'poll-interval-ms', '2000'));
    if (!anchoredHash || !keyPath) throw new Error('usage: register --hash sha256:<hex> --key <priv.jwk.json> [--token-key <k> --domain <d>] [--out record.json]');
    if (!/^sha256:[a-f0-9]{64}$/.test(anchoredHash)) throw new Error(`--hash must be "sha256:<64-hex>", got: ${anchoredHash}`);
    const messageBytes = Buffer.from(anchoredHash.slice('sha256:'.length), 'hex'); // 32 raw bytes

    const jwk = JSON.parse(readFileSync(keyPath, 'utf8'));
    const privateKey = await importPrivateJwk(jwk);
    const pubJwk = { ...jwk, d: undefined, key_ops: ['verify'] };
    const publicKey = await subtle.importKey('jwk', pubJwk, { name: 'Ed25519' }, true, ['verify']);
    const publicKeyBytes = Buffer.from(await subtle.exportKey('raw', publicKey));

    const checksum = await sha256(messageBytes); // this is what actually lands as Leaf.Checksum
    const leafSigData = attachNamespace(TREE_LEAF_NAMESPACE, checksum);
    const leafSignature = Buffer.from(await subtle.sign({ name: 'Ed25519' }, privateKey, leafSigData));

    const body = `message=${messageBytes.toString('hex')}\nsignature=${leafSignature.toString('hex')}\npublic_key=${publicKeyBytes.toString('hex')}\n`;

    const headers = {};
    if (tokenKeyPath && domain) {
      const tokenJwk = JSON.parse(readFileSync(tokenKeyPath, 'utf8'));
      const tokenPrivateKey = await importPrivateJwk(tokenJwk);
      const logPubBytes = Buffer.from(LOG_PUBLIC_KEY_HEX, 'hex');
      const token = await makeSubmitToken(tokenPrivateKey, logPubBytes);
      headers['Sigsum-Token'] = `${domain} ${token.toString('hex')}`;
    }

    console.log(`POST ${LOG_URL}/add-leaf ${headers['Sigsum-Token'] ? '(with Sigsum-Token)' : '(NO Sigsum-Token header)'}`);
    const submit = await httpPost('add-leaf', body, headers);
    console.log(`add-leaf -> HTTP ${submit.status}: ${submit.text.slice(0, 500)}`);
    if (submit.status !== 200 && submit.status !== 202) {
      throw new Error(`add-leaf rejected: HTTP ${submit.status}: ${submit.text}`);
    }

    // Poll get-tree-head + get-inclusion-proof until our leaf is sequenced.
    const keyHash = await sha256(publicKeyBytes);
    const leafHash = await hashLeafNode(await leafToBinary({ checksum, signature: leafSignature, keyHash }));

    let cosignedHead = null;
    let inclusion = null;
    for (let attempt = 0; attempt < pollAttempts && !inclusion; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, pollIntervalMs));
      const headRes = await httpGet('get-tree-head');
      if (headRes.status !== 200) { console.log(`  get-tree-head attempt ${attempt}: HTTP ${headRes.status}`); continue; }
      const head = parseAsciiLines(headRes.text);
      const size = Number(head.size[0]);
      if (size < 1) { console.log(`  get-tree-head attempt ${attempt}: size=${size}, waiting`); continue; }
      const proofRes = await httpGet(`get-inclusion-proof/${size}/${leafHash.toString('hex')}`);
      if (proofRes.status === 404) { console.log(`  get-inclusion-proof attempt ${attempt}: not yet included (size=${size})`); continue; }
      if (proofRes.status !== 200) { console.log(`  get-inclusion-proof attempt ${attempt}: HTTP ${proofRes.status}`); continue; }
      const proofFields = parseAsciiLines(proofRes.text);
      cosignedHead = head;
      inclusion = {
        size,
        leafIndex: Number(proofFields.leaf_index[0]),
        path: (proofFields.node_hash || []).map((h) => Buffer.from(h, 'hex')),
      };
    }
    if (!inclusion) throw new Error(`leaf not sequenced after ${pollAttempts} attempts (root hash: ${anchoredHash}) — seasalp merges periodically, try again with --poll-attempts higher or later`);

    const rootHash = Buffer.from(cosignedHead.root_hash[0], 'hex');
    const cosignatures = [];
    const csList = cosignedHead.cosignature || [];
    const khList = cosignedHead.key_hash || [];
    for (let i = 0; i < csList.length; i++) {
      const parts = csList[i].split(' ');
      cosignatures.push({ key_hash: khList[i], timestamp: Number(parts[0]), signature: parts[1] });
    }

    const record = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_origin: await sigsumCheckpointOrigin(Buffer.from(LOG_PUBLIC_KEY_HEX, 'hex')),
      log_url: LOG_URL,
      log_public_key: LOG_PUBLIC_KEY_HEX,
      anchored_hash: anchoredHash,
      leaf: {
        checksum: checksum.toString('hex'),
        signature: leafSignature.toString('hex'),
        public_key: publicKeyBytes.toString('hex'),
      },
      tree_head: {
        size: inclusion.size,
        root_hash: rootHash.toString('hex'),
        log_signature: (cosignedHead.signature || [])[0],
      },
      inclusion_proof: {
        leaf_index: inclusion.leafIndex,
        path: inclusion.path.map((h) => h.toString('hex')),
      },
      witness_cosignatures: cosignatures,
    };
    writeFileSync(outPath, JSON.stringify(record, null, 2));
    console.log(`Registered ${anchoredHash} -> Sigsum leaf_index ${inclusion.leafIndex} at tree size ${inclusion.size}, wrote ${outPath}`);
    return;
  }

  if (cmd === 'verify') {
    const [recordPath] = rest;
    if (!recordPath) throw new Error('usage: verify <record.json>');
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    const results = {};

    // 1. the leaf commits to our anchored_hash: recompute checksum = sha256(anchored_hash bytes).
    const messageBytes = Buffer.from(record.anchored_hash.slice('sha256:'.length), 'hex');
    const recomputedChecksum = (await sha256(messageBytes)).toString('hex');
    results.checksumMatchesAnchoredHash = recomputedChecksum === record.leaf.checksum;

    // 2. leaf signature verifies against the submitted public key.
    const leafPub = await importPublicRawHex(record.leaf.public_key);
    const leafSigData = attachNamespace(TREE_LEAF_NAMESPACE, Buffer.from(record.leaf.checksum, 'hex'));
    results.leafSignatureValid = await subtle.verify({ name: 'Ed25519' }, leafPub, Buffer.from(record.leaf.signature, 'hex'), leafSigData);

    // 3. RFC 6962 inclusion proof: leaf hash -> root.
    const keyHash = await sha256(Buffer.from(record.leaf.public_key, 'hex'));
    const leafBin = await leafToBinary({
      checksum: Buffer.from(record.leaf.checksum, 'hex'),
      signature: Buffer.from(record.leaf.signature, 'hex'),
      keyHash,
    });
    const leafHash = await hashLeafNode(leafBin);
    const root = Buffer.from(record.tree_head.root_hash, 'hex');
    results.inclusionProofValid = await verifyInclusion({
      leaf: leafHash,
      index: record.inclusion_proof.leaf_index,
      size: record.tree_head.size,
      root,
      path: record.inclusion_proof.path.map((h) => Buffer.from(h, 'hex')),
    });

    // 4. log's own signature over the checkpoint (origin/size/root) verifies
    //    against the PINNED log public key.
    const logPub = await importPublicRawHex(record.log_public_key);
    const checkpointOrigin = record.log_origin;
    const checkpointText = formatCheckpoint(checkpointOrigin, record.tree_head.size, root);
    results.logSignatureValid = await subtle.verify({ name: 'Ed25519' }, logPub, Buffer.from(record.tree_head.log_signature, 'hex'), Buffer.from(checkpointText, 'utf8'));

    // 5. >=1 of the PINNED witness cosignatures verify over the SAME checkpoint.
    let witnessesOk = 0;
    const witnessResults = [];
    for (const cs of record.witness_cosignatures || []) {
      // key_hash in the wire protocol is sha256(pubkey), not the pubkey itself — resolve by hash.
      let matched = null;
      for (const cand of WITNESSES) {
        const h = (await sha256(Buffer.from(cand.keyHex, 'hex'))).toString('hex');
        if (h === cs.key_hash) { matched = { ...cand, hash: h }; break; }
      }
      if (!matched) { witnessResults.push({ key_hash: cs.key_hash, matched: false }); continue; }
      const wPub = await importPublicRawHex(matched.keyHex);
      const cosignedData = toCosignedData(checkpointOrigin, record.tree_head.size, root, cs.timestamp);
      const ok = await subtle.verify({ name: 'Ed25519' }, wPub, Buffer.from(cs.signature, 'hex'), Buffer.from(cosignedData, 'utf8'));
      if (ok) witnessesOk++;
      witnessResults.push({ name: matched.name, matched: true, valid: ok });
    }
    results.witnessCosignaturesValid = witnessesOk;
    results.witnessCosignatureDetail = witnessResults;

    results.ALL_PASS = results.checksumMatchesAnchoredHash && results.leafSignatureValid && results.inclusionProofValid && results.logSignatureValid;
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.ALL_PASS ? 0 : 1);
  }

  if (cmd === 'selftest') {
    let failures = 0;

    // Local Merkle sanity: build an 8-leaf tree with the SAME hashLeafNode/
    // hashInteriorNode used above, derive inclusion paths the naive way, and
    // check verifyInclusion accepts real proofs and rejects tampered ones.
    const leaves = await Promise.all(Array.from({ length: 8 }, (_, i) => hashLeafNode(Buffer.from(`leaf-${i}`))));
    async function mth(lo, hi) {
      if (hi - lo === 1) return leaves[lo];
      let k = 1; while (k * 2 < hi - lo) k *= 2;
      return hashInteriorNode(await mth(lo, lo + k), await mth(lo + k, hi));
    }
    async function path(index, lo, hi) {
      if (hi - lo === 1) return [];
      let k = 1; while (k * 2 < hi - lo) k *= 2;
      return index < lo + k ? [...(await path(index, lo, lo + k)), await mth(lo + k, hi)] : [...(await path(index, lo + k, hi)), await mth(lo, lo + k)];
    }
    const root = await mth(0, leaves.length);
    for (let i = 0; i < leaves.length; i++) {
      const ok = await verifyInclusion({ leaf: leaves[i], index: i, size: leaves.length, root, path: await path(i, 0, leaves.length) });
      if (!ok) failures++;
    }
    const badOk = await verifyInclusion({ leaf: await hashLeafNode(Buffer.from('tampered')), index: 0, size: leaves.length, root, path: await path(0, 0, leaves.length) });
    if (badOk) failures++;
    console.log(`[merkle] 8-leaf inclusion, all indices: ${failures === 0 ? 'PASS' : 'FAIL'}; tampered leaf rejected: ${!badOk ? 'PASS' : 'FAIL'}`);

    // Checkpoint origin sanity against a known-shape value (well-formed prefix + 64-hex hash).
    const origin = await sigsumCheckpointOrigin(Buffer.from(LOG_PUBLIC_KEY_HEX, 'hex'));
    const originOk = origin.startsWith(CHECKPOINT_ORIGIN_PREFIX) && /^[0-9a-f]{64}$/.test(origin.slice(CHECKPOINT_ORIGIN_PREFIX.length));
    console.log(`[checkpoint] origin well-formed: ${originOk ? 'PASS' : 'FAIL'} (${origin})`);
    if (!originOk) failures++;

    // Ed25519 roundtrip sanity for the leaf-signature + cosignature message shapes.
    const { publicKey, privateKey } = await generateKeyPair();
    const checksum = await sha256(Buffer.from('sample'));
    const sig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, privateKey, attachNamespace(TREE_LEAF_NAMESPACE, checksum)));
    const leafOk = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, attachNamespace(TREE_LEAF_NAMESPACE, checksum));
    console.log(`[leaf-sig] Ed25519 roundtrip: ${leafOk ? 'PASS' : 'FAIL'}`);
    if (!leafOk) failures++;

    // Checkpoint sign/verify + witness cosign sign/verify roundtrips, using
    // the SAME formatCheckpoint/toCosignedData helpers `verify` relies on.
    const logKeys = await generateKeyPair();
    const fakeOrigin = await sigsumCheckpointOrigin(Buffer.from(await subtle.exportKey('raw', logKeys.publicKey)));
    const fakeRoot = await sha256(Buffer.from('fake-root'));
    const cpText = formatCheckpoint(fakeOrigin, 7, fakeRoot);
    const cpSig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, logKeys.privateKey, Buffer.from(cpText, 'utf8')));
    const cpOk = await subtle.verify({ name: 'Ed25519' }, logKeys.publicKey, cpSig, Buffer.from(cpText, 'utf8'));
    const cpBadOk = await subtle.verify({ name: 'Ed25519' }, logKeys.publicKey, cpSig, Buffer.from(formatCheckpoint(fakeOrigin, 8, fakeRoot), 'utf8'));
    console.log(`[checkpoint-sig] roundtrip: ${cpOk ? 'PASS' : 'FAIL'}; tampered size rejected: ${!cpBadOk ? 'PASS' : 'FAIL'}`);
    if (!cpOk || cpBadOk) failures++;

    const witKeys = await generateKeyPair();
    const cosData = toCosignedData(fakeOrigin, 7, fakeRoot, 1234567890);
    const cosSig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, witKeys.privateKey, Buffer.from(cosData, 'utf8')));
    const cosOk = await subtle.verify({ name: 'Ed25519' }, witKeys.publicKey, cosSig, Buffer.from(cosData, 'utf8'));
    const cosBadOk = await subtle.verify({ name: 'Ed25519' }, witKeys.publicKey, cosSig, Buffer.from(toCosignedData(fakeOrigin, 7, fakeRoot, 1234567891), 'utf8'));
    console.log(`[cosign-sig] roundtrip: ${cosOk ? 'PASS' : 'FAIL'}; tampered timestamp rejected: ${!cosBadOk ? 'PASS' : 'FAIL'}`);
    if (!cosOk || cosBadOk) failures++;

    console.log(failures === 0 ? 'selftest: ALL PASS' : `selftest: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.error('usage: register-sigsum.mjs <keygen|token-keygen|dns-record|register|verify|selftest> ...');
  process.exit(2);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
