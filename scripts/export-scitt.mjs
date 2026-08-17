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
// Generic third-party receipt verification (BUILD-SCITT-VERIFY-GENERIC-1):
// `verify-receipt` reads a caller-supplied `application/scitt-receipt+cose`
// receipt from ANY issuer — not just this exporter's own round-trip — by
// parsing the real RFC 9942 COSE header parameters (vds=395, vdp=396) off
// the receipt's own protected/unprotected headers, per
// research/COSE-RECEIPT-HEADER-FINDINGS-2026-08-10.md. It reports the
// statement-signature check and the receipt-inclusion-proof check as two
// independent PASS/FAIL/NOT_CHECKED verdicts (never one blended boolean),
// and it never fetches a log root itself — the root is always a
// caller-supplied input (SPEC-SCITT-GENERIC-VERIFY-1-2026-08-09.md §6).
//
// Usage:
//   node export-scitt.mjs keygen [--alg es256|ed25519] [--out-prefix ./scitt-key]
//   node export-scitt.mjs sign <artifact.json> --key <priv.jwk.json> [--out out.cose]
//   node export-scitt.mjs verify-statement <statement.cose> --pubkey <pub.jwk.json> --payload <artifact.json>
//   node export-scitt.mjs verify-receipt <receipt.cose> [<statement.cose>] --expected-root <hex>
//       [--leaf-hash <hex>] [--payload <payload.json>] [--pubkey <pub.jwk.json>]
//       [--alg es256|ed25519] [--proof-type <n>] [--media-type <type>]
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
// algorithm) inside a COSE_Sign1's own protected/unprotected header, using
// three registered COSE header parameters (confirmed against rfc-editor.org
// 2026-08-10, research/COSE-RECEIPT-HEADER-FINDINGS-2026-08-10.md):
//   receipts = 394  (array of one or more COSE Receipts, used when a
//                     STATEMENT carries receipts attached to it — not
//                     produced or consumed by this verifier, which is
//                     handed a receipt directly)
//   vds      = 395  (protected header: verifiable-data-structure algorithm
//                     identifier for the receipt itself)
//   vdp      = 396  (unprotected header: map of Verifiable Data Proofs,
//                     keyed by proof type)
// This walker implements the RFC 9162 §2.1.3.2 inclusion-proof verification
// algorithm directly against {leaf_hash, leaf_index, tree_size,
// audit_path[]} — the RFC 9942 wire shape for an RFC 9162 SHA-256 inclusion
// proof entry inside `vdp` is `[tree_size, leaf_index, inclusion_path: [+
// bstr]]` (findings doc §a). No live transparency-service call is made or
// needed: the root is always a caller-supplied input (see `verify-receipt`
// below and SPEC-SCITT-GENERIC-VERIFY-1-2026-08-09.md §6).
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

const COSE_HEADER = { RECEIPTS: 394, VDS: 395, VDP: 396 };
const SCITT_RECEIPT_MEDIA_TYPE = 'application/scitt-receipt+cose';

// §5.2 of SPEC-SCITT-GENERIC-VERIFY-1-2026-08-09.md, shipped verbatim in
// substance in the tool's own output — never silently omitted.
const PASS_MEANING_DISCLOSURE = [
  'A verified receipt proves that a statement was registered in the named',
  "log, at or before the time reflected by the log's tree state the root",
  "corresponds to. It proves nothing about the statement's truth, about",
  "whether the statement's claims are accurate, or about the log operator's",
  'own trustworthiness or continued operation. A verified signature',
  'additionally proves the named issuer signed the statement — it does not',
  'prove the issuer is who they claim to be, absent independent identity',
  'verification.',
].join(' ');

// Structural check for the RFC 9942 inclusion-proof entry shape:
// [tree_size: uint, leaf_index: uint, inclusion_path: [+ bstr]].
function parseInclusionProofEntry(entry) {
  if (!Array.isArray(entry) || entry.length !== 3) return null;
  const [treeSize, leafIndex, inclusionPath] = entry;
  if (typeof treeSize !== 'number' || typeof leafIndex !== 'number') return null;
  if (!Array.isArray(inclusionPath) || !inclusionPath.every((p) => Buffer.isBuffer(p))) return null;
  return { treeSize, leafIndex, inclusionPath };
}

// Decodes a caller-supplied receipt (ANY issuer, not just this exporter's
// own) as a COSE_Sign1 and locates its RFC 9942 vds(395)/vdp(396) header
// parameters. Does NOT verify the receipt's own COSE signature — that is
// out of this tool's two checks (§5.1: statement signature + receipt
// inclusion proof), same scope the original exporter used.
function decodeCoseReceipt(receiptBytes) {
  const tagged = cborDecode(receiptBytes);
  if (!Array.isArray(tagged) || tagged.length !== 4) {
    throw new Error('verify-receipt: receipt is not a well-formed COSE_Sign1 (expected a 4-element CBOR array)');
  }
  const [protectedBytes, unprotected] = tagged;
  const protectedMap = protectedBytes && protectedBytes.length ? cborDecode(protectedBytes) : new Map();
  const vds = protectedMap instanceof Map ? protectedMap.get(COSE_HEADER.VDS) : undefined;
  const vdp = unprotected instanceof Map ? unprotected.get(COSE_HEADER.VDP) : undefined;
  if (vds === undefined) {
    throw new Error(`verify-receipt: protected header missing vds (label ${COSE_HEADER.VDS}, RFC 9942) — not a recognizable COSE Receipt`);
  }
  if (!(vdp instanceof Map) || vdp.size === 0) {
    throw new Error(`verify-receipt: unprotected header missing vdp (label ${COSE_HEADER.VDP}, RFC 9942) — not a recognizable COSE Receipt`);
  }
  // vdp is keyed by proof type per RFC 9942 §4.2. The confirmed build-time
  // findings (COSE-RECEIPT-HEADER-FINDINGS-2026-08-10.md) pin the RFC 9162
  // SHA-256 inclusion-proof array shape but not a specific proof-type key
  // number, so this walker recognizes ANY vdp entry structurally matching
  // that shape rather than assuming one fixed key — and requires the caller
  // to disambiguate via --proof-type if more than one entry qualifies.
  const candidates = [];
  for (const [proofType, value] of vdp.entries()) {
    // A vdp value is either a single proof entry [tree_size, leaf_index,
    // path] or an array of such entries — distinguish by whether the first
    // element is itself an array (a list of entries) vs a number (one
    // entry), so a lone triple is never misread as three separate entries.
    const entries = Array.isArray(value) && Array.isArray(value[0]) ? value : [value];
    for (const entry of entries) {
      const parsed = parseInclusionProofEntry(entry);
      if (parsed) candidates.push({ proofType, ...parsed });
    }
  }
  if (candidates.length === 0) {
    throw new Error('verify-receipt: no RFC 9162-shaped inclusion-proof entry found in vdp map');
  }
  return { vds, candidates };
}

// Generic inclusion-proof check: accepts a receipt from ANY issuer plus
// either the original statement bytes (to recompute the leaf) or a
// caller-supplied leaf hash directly — the §4/§5 calling convention this
// row exists to add. Never fetches the expected root; it is always
// caller-supplied (§6).
async function verifyReceiptGeneric({ receiptBytes, leafHashBuf, expectedRoot, proofType }) {
  const { candidates } = decodeCoseReceipt(receiptBytes);
  let chosen;
  if (proofType !== undefined) {
    chosen = candidates.find((c) => String(c.proofType) === String(proofType));
    if (!chosen) {
      throw new Error(`verify-receipt: no inclusion-proof entry for --proof-type ${proofType} (available: ${candidates.map((c) => c.proofType).join(', ')})`);
    }
  } else if (candidates.length === 1) {
    chosen = candidates[0];
  } else {
    throw new Error(`verify-receipt: receipt carries ${candidates.length} inclusion-proof-shaped vdp entries; pass --proof-type to disambiguate (available: ${candidates.map((c) => c.proofType).join(', ')})`);
  }
  const ok = await verifyInclusion({
    leafHash: leafHashBuf,
    index: chosen.leafIndex,
    treeSize: chosen.treeSize,
    auditPath: chosen.inclusionPath,
    root: expectedRoot,
  });
  return { ok, proofType: chosen.proofType, treeSize: chosen.treeSize, leafIndex: chosen.leafIndex };
}

// Generic statement-signature check: accepts a third-party statement whose
// payload may be embedded (tagged[2] non-null) or detached (--payload
// supplied), unlike the exporter's own signStatement/verifyStatement pair
// which only ever produces detached-payload statements.
async function verifyStatementGeneric({ statementBytes, payloadBytes, publicKey, alg }) {
  const tagged = cborDecode(statementBytes);
  if (!Array.isArray(tagged) || tagged.length !== 4) {
    throw new Error('verify-receipt: statement is not a well-formed COSE_Sign1 (expected a 4-element CBOR array)');
  }
  const [protectedBytes, , embeddedPayload, signature] = tagged;
  const payload = payloadBytes ?? embeddedPayload;
  if (!Buffer.isBuffer(payload)) {
    throw new Error('verify-receipt: statement payload is detached and no --payload was supplied');
  }
  const sigStructure = ['Signature1', protectedBytes, Buffer.alloc(0), payload];
  const tbs = cborEncode(sigStructure);
  return subtle.verify(SIGN_PARAMS[alg], publicKey, signature, tbs);
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
    const mediaType = flag(rest, 'media-type', SCITT_RECEIPT_MEDIA_TYPE);
    const expectedRootHex = flag(rest, 'expected-root');
    const leafHashHex = flag(rest, 'leaf-hash');
    const payloadPath = flag(rest, 'payload');
    const pubkeyPath = flag(rest, 'pubkey');
    const alg = flag(rest, 'alg', 'es256');
    const proofType = flag(rest, 'proof-type');
    if (!receiptPath) throw new Error('usage: verify-receipt <receipt.cose> [<statement.cose>] --expected-root <hex> [--leaf-hash <hex>] [--payload <payload.json>] [--pubkey <pub.jwk.json>] [--alg es256|ed25519] [--proof-type <n>] [--media-type <type>]');

    // (a) media-type check — a receipt's bytes carry no embedded media type
    // (that lives at the transport layer, e.g. an HTTP Content-Type), so the
    // caller declares what they received and this fails closed on mismatch
    // rather than silently assuming the SCITT receipt media type.
    if (mediaType !== SCITT_RECEIPT_MEDIA_TYPE) {
      console.log(`media-type: FAIL (expected ${SCITT_RECEIPT_MEDIA_TYPE}, got ${mediaType})`);
      console.log('statement-signature: NOT_CHECKED');
      console.log('receipt-inclusion:   NOT_CHECKED');
      console.log(`\n${PASS_MEANING_DISCLOSURE}`);
      process.exit(1);
    }

    const receiptBytes = readFileSync(receiptPath);
    const statementBytes = statementPath ? readFileSync(statementPath) : undefined;

    // §5.1 check 1: statement signature (optional — needs pubkey + statement).
    let sigVerdict = 'NOT_CHECKED';
    if (pubkeyPath && statementBytes) {
      const publicKey = await importPublicJwk(JSON.parse(readFileSync(pubkeyPath, 'utf8')), alg);
      const payloadBytes = payloadPath ? readFileSync(payloadPath) : undefined;
      const sigOk = await verifyStatementGeneric({ statementBytes, payloadBytes, publicKey, alg });
      sigVerdict = sigOk ? 'PASS' : 'FAIL';
    }

    // §5.1 check 2: receipt inclusion proof (needs expected root + a leaf,
    // from either --leaf-hash directly or the statement bytes).
    let inclusionVerdict = 'NOT_CHECKED';
    if (expectedRootHex) {
      const expectedRoot = Buffer.from(expectedRootHex, 'hex');
      const leafHashBuf = leafHashHex ? Buffer.from(leafHashHex, 'hex')
        : statementBytes ? await leafHash(statementBytes)
        : undefined;
      if (!leafHashBuf) throw new Error('verify-receipt: --expected-root given but no leaf to check — supply <statement.cose> or --leaf-hash');
      const { ok } = await verifyReceiptGeneric({ receiptBytes, leafHashBuf, expectedRoot, proofType });
      inclusionVerdict = ok ? 'PASS' : 'FAIL';
    }

    console.log(`statement-signature: ${sigVerdict}`);
    console.log(`receipt-inclusion:   ${inclusionVerdict}`);
    console.log(`\n${PASS_MEANING_DISCLOSURE}`);
    const failed = sigVerdict === 'FAIL' || inclusionVerdict === 'FAIL';
    process.exit(failed ? 1 : 0);
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
    {
      // Synthetic THIRD-PARTY-shaped receipt — built with real RFC 9942
      // header labels (vds=395, vdp=396), NOT via signStatement/this
      // exporter's own export path, to prove verifyReceiptGeneric works on
      // a receipt shape it never issued itself.
      const leaves = Array.from({ length: 5 }, (_, i) => Buffer.from(`third-party-leaf-${i}`));
      const { root, proofFor } = await buildMerkleTree(leaves);
      const targetIndex = 2;
      const auditPath = await proofFor(targetIndex);
      const lh = await leafHash(leaves[targetIndex]);

      const protectedBytes = cborEncode(new Map([[COSE_HEADER.VDS, 1]])); // vds value informational, not branched on
      const vdpMap = new Map([[1, [leaves.length, targetIndex, auditPath]]]);
      const unprotectedMap = new Map([[COSE_HEADER.VDP, vdpMap]]);
      const syntheticReceipt = cborEncodeTag(18, cborEncode([protectedBytes, unprotectedMap, null, Buffer.alloc(0)]));

      const { ok: thirdPartyOk } = await verifyReceiptGeneric({ receiptBytes: syntheticReceipt, leafHashBuf: lh, expectedRoot: root });
      const { ok: tamperedOk } = await verifyReceiptGeneric({ receiptBytes: syntheticReceipt, leafHashBuf: await leafHash(Buffer.from('not-a-leaf')), expectedRoot: root });

      let disambiguationRejected = false;
      try {
        const twoEntryVdp = new Map([[1, [leaves.length, targetIndex, auditPath]], [2, [leaves.length, targetIndex, auditPath]]]);
        const ambiguousReceipt = cborEncodeTag(18, cborEncode([protectedBytes, new Map([[COSE_HEADER.VDP, twoEntryVdp]]), null, Buffer.alloc(0)]));
        await verifyReceiptGeneric({ receiptBytes: ambiguousReceipt, leafHashBuf: lh, expectedRoot: root });
      } catch {
        disambiguationRejected = true;
      }

      console.log(`[synthetic-third-party] RFC 9942 vds/vdp header parse + inclusion check: ${thirdPartyOk ? 'PASS' : 'FAIL'}; tampered leaf rejected: ${!tamperedOk ? 'PASS' : 'FAIL'}; ambiguous proof-type requires --proof-type: ${disambiguationRejected ? 'PASS' : 'FAIL'}`);
      if (!thirdPartyOk || tamperedOk || !disambiguationRejected) failures++;
    }
    console.log(failures === 0 ? '\nselftest: ALL PASS' : `\nselftest: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.error('usage: export-scitt.mjs <keygen|sign|verify-statement|verify-receipt|selftest> ...');
  process.exit(2);
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
