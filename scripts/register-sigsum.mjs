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
//   Trust policy: the OFFICIAL NAMED POLICY "sigsum-generic-2025-1" (first
//   published sigsum-go 0.13.0) — see the pinned-policy comment block below
//   for the full source citation and the verbatim upstream policy text.
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
import {
  hashLeafNode as sharedHashLeafNode,
  hashInteriorNode as sharedHashInteriorNode,
  verifyInclusion as sharedVerifyInclusion,
  formatCheckpoint as sharedFormatCheckpoint,
  toCosignedData as sharedToCosignedData,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';

const subtle = webcrypto.subtle;

// ---------------------------------------------------------------------------
// Pinned trust policy — sigsum-go's OFFICIAL NAMED POLICY "sigsum-generic-2025-1"
// (first published in sigsum-go 0.13.0; Glasklar Teknik announcement "Named
// policies for Sigsum", https://www.glasklarteknik.se/post/named-policies-for-sigsum/,
// accessed 2026-08-13). A named policy is versioned and, per that announcement,
// "once a built-in named policy has been released, its contents should not
// change" — pinning it here by NAME+VERSION (never re-fetched at verify time,
// per the CHAINPOINT GUARD below) is exactly the trust-continuity mechanism
// the Sigsum project built this feature for. This SUPERSEDES the SIGSUM-ANCHOR-1
// ad-hoc pin (fetched 2026-08-10, pre-dates the named policy's release) with a
// versioned upstream reference plus a third, independent witness (Tillitis).
//
// Canonical source (fetched fresh 2026-08-13, quoted verbatim below):
//   git.glasklar.is/sigsum/core/sigsum-go/-/raw/main/pkg/policy/builtin/sigsum-generic-2025-1.builtin-policy
//   mirrored: raw.githubusercontent.com/sigsum/sigsum-go/main/pkg/policy/builtin/sigsum-generic-2025-1.builtin-policy
//
//   # This is a Sigsum trust policy that has been vetted by the Sigsum project
//   # See https://git.glasklar.is/sigsum/project/documentation/-/blob/main/policy-maintenance.md
//
//   # https://git.glasklar.is/glasklar/services/sigsum-logs/-/blob/main/instances/seasalp.md (accessed 2025-12-04)
//   log 0ec7e16843119b120377a73913ac6acbc2d03d82432e2c36b841b09a95841f25 https://seasalp.glasklar.is
//
//   # https://ginkgo.tlog.mullvad.net/about (accessed 2025-12-04)
//   log f00c159663d09bbda6131ee1816863b6adcacfe80b0b288000b11aba8fe38314 https://ginkgo.tlog.mullvad.net
//
//   # https://git.glasklar.is/glasklar/services/witnessing/-/blob/main/witness.glasklar.is/about.md (accessed 2025-12-04)
//   witness witness.glasklar.is            b2106db9065ec97f25e09c18839216751a6e26d8ed8b41e485a563d3d1498536
//
//   # https://witness.mullvad.net/about (accessed 2025-12-04)
//   witness witness.mullvad.net            15d6d0141543247b74bab3c1076372d9c894f619c376d64b29aa312cc00f61ad
//
//   # https://github.com/tillitis/tillitis.se-tillitis-witness-1/blob/main/about.md (accessed 2025-12-04)
//   witness tillitis.se/tillitis-witness-1 076be8c9ee7ea60916f0df3608c945d7730082ecb37749dad2c9ed339fea770c
//
//   # Requiring 2 of 3 is intended to give reasonable balance between security and availability.
//   group quorum-rule 2 witness.glasklar.is witness.mullvad.net tillitis.se/tillitis-witness-1
//
//   quorum quorum-rule
//
// We TRANSCRIBE this data only (never vendor sigsum-go — CONTRACT.md zero-dep
// forever): two logs, three witnesses, 2-of-3 quorum. `register` below still
// submits to seasalp only (LOG_URL/LOG_PUBLIC_KEY_HEX, unchanged) — wiring
// Mullvad-log submission is a separate, larger change outside this fence.
// `verify` now accepts a record anchored to EITHER pinned log (LOGS below),
// which is what the named policy actually grants, and requires the 2-of-3
// witness quorum the policy defines (WITNESS_QUORUM_THRESHOLD).
//
// REGRESSION: records registered under the pre-named-policy pin
// (SIGSUM-ANCHOR-2, leaf_index 59524, only 2 witnesses known at the time)
// still verify here — seasalp's key and both original witnesses are
// UNCHANGED by this upgrade; the third witness and second log are ADDITIVE,
// and 59524's own 14 witness cosignatures already clear the 2-of-3 quorum.
// See scripts/register-sigsum.test.mjs (fixture:
// scripts/register-sigsum.fixtures.json, key sigsum_anchor_2_record).
// ---------------------------------------------------------------------------
const LOG_URL = 'https://seasalp.glasklar.is'; // submission target (register/dns-record) — unchanged
const LOG_PUBLIC_KEY_HEX = '0ec7e16843119b120377a73913ac6acbc2d03d82432e2c36b841b09a95841f25';

// Both logs named in sigsum-generic-2025-1 — `verify` accepts a record anchored
// to either. `register` (submission) still targets LOG_URL/LOG_PUBLIC_KEY_HEX above only.
const LOGS = [
  { name: 'seasalp.glasklar.is', keyHex: LOG_PUBLIC_KEY_HEX, url: LOG_URL },
  { name: 'ginkgo.tlog.mullvad.net', keyHex: 'f00c159663d09bbda6131ee1816863b6adcacfe80b0b288000b11aba8fe38314', url: 'https://ginkgo.tlog.mullvad.net' },
];

const WITNESSES = [
  { name: 'witness.glasklar.is', keyHex: 'b2106db9065ec97f25e09c18839216751a6e26d8ed8b41e485a563d3d1498536' },
  { name: 'witness.mullvad.net', keyHex: '15d6d0141543247b74bab3c1076372d9c894f619c376d64b29aa312cc00f61ad' },
  { name: 'tillitis.se/tillitis-witness-1', keyHex: '076be8c9ee7ea60916f0df3608c945d7730082ecb37749dad2c9ed339fea770c' },
];
// "group quorum-rule 2 witness.glasklar.is witness.mullvad.net tillitis.se/tillitis-witness-1"
// above: sigsum-generic-2025-1 requires 2-of-3 pinned witnesses to cosign.
const WITNESS_QUORUM_THRESHOLD = 2;

const CHECKPOINT_ORIGIN_PREFIX = 'sigsum.org/v1/tree/';
const COSIGNATURE_NAMESPACE = 'cosignature/v1';
const TREE_LEAF_NAMESPACE = 'sigsum.org/v1/tree-leaf';
const SUBMIT_TOKEN_NAMESPACE = 'sigsum.org/v1/submit-token';

// ---------------------------------------------------------------------------
// RFC 6962 Merkle primitives + inclusion-proof walk — imported from the
// shared C2SP module (C2SP-TLOG-VERIFY-MODULE-1), not reimplemented here.
// Thin Buffer-returning wrappers so the rest of this file (which calls
// .toString('hex') / Buffer.compare on the results) needs no other changes.
// ---------------------------------------------------------------------------

async function sha256(...parts) { return Buffer.from(await subtle.digest('SHA-256', Buffer.concat(parts))); }
async function hashLeafNode(b) { return Buffer.from(await sharedHashLeafNode(b)); }
async function hashInteriorNode(l, r) { return Buffer.from(await sharedHashInteriorNode(l, r)); }
async function verifyInclusion({ leaf, index, size, root, path }) {
  return sharedVerifyInclusion({ leaf, index, size, root, path });
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
  return sharedFormatCheckpoint(origin, size, rootHash);
}

async function sigsumCheckpointOrigin(logPublicKeyBytes) {
  const h = await sha256(logPublicKeyBytes);
  return `${CHECKPOINT_ORIGIN_PREFIX}${h.toString('hex')}`;
}

function toCosignedData(origin, size, rootHash, timestamp) {
  return sharedToCosignedData(origin, size, rootHash, timestamp, COSIGNATURE_NAMESPACE);
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
    for (let i = 0; i < csList.length; i++) {
      // Each `cosignature=` line is ONE field: "<key_hash_hex> <timestamp> <signature_hex>"
      // (measured live against seasalp's get-tree-head response) — NOT split across a
      // parallel `key_hash=` field, which the response never sends.
      const parts = csList[i].split(' ');
      cosignatures.push({ key_hash: parts[0], timestamp: Number(parts[1]), signature: parts[2] });
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

    // 4. the record's log_public_key must be ONE OF THE PINNED sigsum-generic-2025-1
    //    logs (SO #34 — never trust a record's own claim about which log this is;
    //    the prior version of this check imported record.log_public_key directly,
    //    which let ANY self-signed keypair pass as "the log"). The checkpoint
    //    origin is INDEPENDENTLY DERIVED from the matched PINNED key, never taken
    //    from record.log_origin — verified to reproduce byte-for-byte against the
    //    real SIGSUM-ANCHOR-2 record's origin (see register-sigsum.test.mjs).
    const matchedLog = LOGS.find((l) => l.keyHex === record.log_public_key);
    results.logKeyPinned = !!matchedLog;
    results.logName = matchedLog ? matchedLog.name : null;
    const checkpointOrigin = matchedLog
      ? await sigsumCheckpointOrigin(Buffer.from(matchedLog.keyHex, 'hex'))
      : record.log_origin; // unpinned key: kept only so the shape below still runs — ALL_PASS is forced false by logKeyPinned
    results.logOriginMatchesPinned = matchedLog ? checkpointOrigin === record.log_origin : false;

    // 5. log's own signature over the checkpoint (derived origin/size/root) verifies
    //    against the PINNED log public key (never a key read out of the record).
    const logPub = await importPublicRawHex(matchedLog ? matchedLog.keyHex : record.log_public_key);
    const checkpointText = formatCheckpoint(checkpointOrigin, record.tree_head.size, root);
    results.logSignatureValid = await subtle.verify({ name: 'Ed25519' }, logPub, Buffer.from(record.tree_head.log_signature, 'hex'), Buffer.from(checkpointText, 'utf8'));

    // 6. >=1 of the PINNED witness cosignatures verify over the SAME checkpoint;
    //    ALL_PASS additionally requires the sigsum-generic-2025-1 2-of-3 QUORUM
    //    (WITNESS_QUORUM_THRESHOLD) — a count against the RECORD'S OWN cosignatures,
    //    never a retroactive demand for a specific witness (an old 2-witness record
    //    still clears a 2-of-3 threshold with its original two).
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
    results.witnessQuorumThreshold = WITNESS_QUORUM_THRESHOLD;
    results.witnessQuorumMet = witnessesOk >= WITNESS_QUORUM_THRESHOLD;

    results.ALL_PASS = results.checksumMatchesAnchoredHash && results.leafSignatureValid && results.inclusionProofValid
      && results.logKeyPinned && results.logOriginMatchesPinned && results.logSignatureValid && results.witnessQuorumMet;
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.ALL_PASS ? 0 : 1);
  }

  if (cmd === 'selftest') {
    let failures = 0;

    // sigsum-generic-2025-1 pin shape: 2 logs, 3 witnesses, 2-of-3 quorum, every
    // key a well-formed 32-byte (64-hex) Ed25519 public key.
    const pinShapeOk = LOGS.length === 2 && WITNESSES.length === 3 && WITNESS_QUORUM_THRESHOLD === 2
      && WITNESS_QUORUM_THRESHOLD <= WITNESSES.length
      && LOGS.every((l) => /^[0-9a-f]{64}$/.test(l.keyHex))
      && WITNESSES.every((w) => /^[0-9a-f]{64}$/.test(w.keyHex));
    console.log(`[pin-shape] sigsum-generic-2025-1 constants well-formed: ${pinShapeOk ? 'PASS' : 'FAIL'}`);
    if (!pinShapeOk) failures++;

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
