// anchor-binding.test.mjs — §20 Anchor Binding GATE (conformance-by-construction, SPEC.md §15, v0.7).
// 100% OFFLINE — fixtures were produced once by _regen-anchor-fixtures.mjs (the only network step).
// Asserts, per the v0.7 delta:
//   (a) rfc3161-tst — a REAL TimeStampToken (FreeTSA) over the fixture artifact's execution_hash
//       verifies against the PINNED TSA root: messageImprint == anchored_hash, CMS signature over
//       TSTInfo valid (signedAttrs messageDigest == hash(TSTInfo)), signer chains to the pinned
//       root, signing cert carries critical EKU id-kp-timeStamping, genTime sane, DER verbatim;
//   (b) opentimestamps — the canonical COMPLETED OTS vector evaluates to the pinned Bitcoin block
//       358391 merkle root (block headers alone — no calendar, no network);
//   (c) c2sp-tlog-proof-v1 — checkpoint signature against the PINNED TEST log key, 2 test
//       cosignatures (verifier policy: all), Merkle inclusion of the leaf committing anchored_hash;
//   (d) scitt-receipt-rfc9942 — COSE_Sign1 receipt (vds=RFC9162_SHA256): inclusion proof rebuilds
//       the root, Sig_structure verifies under the pinned test key;
//   (e) tamper-fail — for each type: tampered proof MUST fail; mismatched anchored_hash MUST fail
//       (a verifier MUST reject a binding whose anchored_hash differs from the recomputed
//       execution_hash); plus §20 scope: anchor_bindings sit OUTSIDE the execution_hash preimage.
// Node 18+ (node:crypto builtins only — zero npm deps).  Run:  node chaingraph/kernels/anchor-binding.test.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import {
  sha256, derRead, derChildrenOf,
  cborDecode, CborTag, cborEncode, leafHash, nodeHash, mth, auditPath, rootFromInclusion,
  rawToPublicKey, ed25519Verify, parseNote, verifyNoteSig, verifyCosigV1,
  verifyMerkleInclusion,
} from './_anchor-testutil.mjs';
// §20/§23 SINGLE SOURCE OF TRUTH for rfc3161-tst verification — reused unchanged by
// validate_input_attestations' rfc3161-snapshot type (SPEC.md §23.1: "no second RFC 3161 impl").
import { verifyRfc3161 } from './_rfc3161.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(readFileSync(join(HERE, 'fixtures', 'anchor-binding.fixture.json'), 'utf8'));

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const b64 = (s) => Buffer.from(s, 'base64');
const bareHash = (h) => String(h).replace(/^sha256:/, '');

// ── binding-level check (§20): anchored_hash MUST equal the artifact's RECOMPUTED execution_hash ──
async function bindingHashOk(binding, artifact) {
  const recomputed = await executionHash(artifact.policy_parameters, artifact.output_payload);
  return bareHash(binding.anchored_hash) === recomputed && recomputed === artifact.execution_hash;
}

// ── opentimestamps verifier (offline: complete proofs vs pinned Bitcoin block header data) ───────
const OTS_MAGIC = Buffer.from('004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294', 'hex');
const BTC_ATTESTATION = '0588960d73d71901';
function verifyOts(otsBytes, { expectFileSha256, pinnedHeight, pinnedMerkleRootDisplay }) {
  const buf = Buffer.from(otsBytes);
  if (!buf.subarray(0, OTS_MAGIC.length).equals(OTS_MAGIC)) throw new Error('bad OTS magic');
  let p = OTS_MAGIC.length;
  const varint = () => { let v = 0n, s = 0n; for (;;) { const b = BigInt(buf[p++]); v |= (b & 0x7fn) << s; if (!(b & 0x80n)) return Number(v); s += 7n; } };
  const varbytes = () => { const n = varint(); const o = buf.subarray(p, p + n); p += n; return o; };
  const version = varint();
  if (version !== 1) throw new Error('unsupported OTS version ' + version);
  const fileHashOp = buf[p++];
  if (fileHashOp !== 0x08) throw new Error('vector is not sha256-committed');
  const fileDigest = buf.subarray(p, p + 32); p += 32;
  if (!fileDigest.equals(Buffer.from(expectFileSha256, 'hex'))) throw new Error('embedded file digest != expected');
  const rmd160 = (b) => createHash('ripemd160').update(b).digest();
  const sha1 = (b) => createHash('sha1').update(b).digest();
  const attestations = [];
  (function walk(msg) {
    for (;;) {
      const tag = buf[p++];
      if (tag === 0xff) { walk(Buffer.from(msg)); continue; }
      if (tag === 0x00) {
        const attTag = buf.subarray(p, p + 8).toString('hex'); p += 8;
        const payload = varbytes();
        if (attTag === BTC_ATTESTATION) {
          let q = 0, v = 0n, s = 0n;
          for (;;) { const b = BigInt(payload[q++]); v |= (b & 0x7fn) << s; if (!(b & 0x80n)) break; s += 7n; }
          attestations.push({ height: Number(v), digest: Buffer.from(msg) });
        }
        return;
      }
      if (tag === 0xf0) msg = Buffer.concat([msg, varbytes()]);
      else if (tag === 0xf1) msg = Buffer.concat([varbytes(), msg]);
      else if (tag === 0x08) msg = sha256(msg);
      else if (tag === 0x03) msg = rmd160(msg);
      else if (tag === 0x02) msg = sha1(msg);
      else if (tag === 0xf2) msg = Buffer.from(msg).reverse();
      else if (tag === 0xf3) msg = Buffer.from(msg.toString('hex'), 'utf8');
      else throw new Error('unknown OTS op 0x' + tag.toString(16));
    }
  })(Buffer.from(fileDigest));
  const hit = attestations.find((a) => a.height === pinnedHeight);
  if (!hit) throw new Error('no Bitcoin attestation at pinned height ' + pinnedHeight);
  // op-chain result = block merkle root in internal byte order; reverse for display-order compare
  const display = Buffer.from(hit.digest).reverse().toString('hex');
  if (display !== pinnedMerkleRootDisplay) throw new Error('evaluated digest != pinned block merkle root');
  return { height: hit.height, merkleRootDisplay: display };
}

// ── c2sp-tlog-proof-v1 verifier ──────────────────────────────────────────────────────────────────
function verifyC2sp(binding, pinned) {
  const lines = binding.proof.split('\n');
  if (lines[0] !== 'c2sp.org/tlog-proof@v1') throw new Error('bad tlog-proof header');
  let i = 1;
  if (lines[i]?.startsWith('extra ')) i++;
  const im = lines[i++].match(/^index (\d+)$/);
  if (!im) throw new Error('missing index line');
  const index = Number(im[1]);
  const path = [];
  while (lines[i] !== '') path.push(Buffer.from(lines[i++], 'base64'));
  i++; // blank line
  const checkpoint = lines.slice(i).join('\n');
  const note = parseNote(checkpoint);
  const [origin, sizeStr, rootB64] = note.body.split('\n');
  if (origin !== pinned.origin || origin !== binding.log_origin) throw new Error('checkpoint origin mismatch');
  const size = Number(sizeStr);
  const root = Buffer.from(rootB64, 'base64');
  // 1. checkpoint signature against the pinned TEST log key
  const logSig = note.sigs.find((s) => s.name === pinned.origin);
  if (!logSig || !verifyNoteSig(note.body, pinned.origin, b64(pinned.log_pubkey_b64), logSig.blob)) {
    throw new Error('checkpoint log signature invalid');
  }
  // 2. cosignature policy (gate policy: ALL pinned test cosigners must verify)
  for (const w of pinned.cosigners) {
    const s = note.sigs.find((x) => x.name === w.name);
    if (!s || !verifyCosigV1(note.body, w.name, b64(w.pubkey_b64), s.blob)) {
      throw new Error(`cosignature from ${w.name} invalid/missing`);
    }
  }
  // 3. Merkle inclusion of the leaf committing anchored_hash
  const leaf = leafHash(Buffer.from(binding.anchored_hash, 'utf8'));
  const rebuilt = rootFromInclusion(leaf, index, size, path);
  if (!rebuilt || !rebuilt.equals(root)) throw new Error('inclusion proof does not bind the leaf to the checkpoint root');
  return { origin, size, index };
}

// ── scitt-receipt-rfc9942 verifier ───────────────────────────────────────────────────────────────
function verifyScitt(binding, pinned) {
  let cose = cborDecode(b64(binding.proof));
  if (cose instanceof CborTag) { if (cose.tag !== 18) throw new Error('not COSE_Sign1 (#6.18)'); cose = cose.value; }
  const [protectedBytes, unprotected, payload, signature] = cose;
  if (payload !== null) throw new Error('receipt payload must be detached (nil)');
  const ph = cborDecode(protectedBytes);
  if (ph.get(1) !== -8) throw new Error('alg is not EdDSA');
  if (ph.get(395) !== 1) throw new Error('vds is not RFC9162_SHA256');
  const vdp = unprotected.get(396);
  const proofs = vdp?.get(-1);
  if (!Array.isArray(proofs) || !proofs.length) throw new Error('no inclusion proof (vdp[-1])');
  const [size, index, path] = cborDecode(proofs[0]);
  const leaf = leafHash(Buffer.from(binding.anchored_hash, 'utf8'));
  const root = rootFromInclusion(leaf, index, size, path);
  if (!root) throw new Error('inclusion path invalid');
  const sigStructure = cborEncode(['Signature1', Buffer.from(protectedBytes), Buffer.alloc(0), root]);
  if (!ed25519Verify(sigStructure, signature, rawToPublicKey(b64(pinned.issuer_pubkey_b64)))) {
    throw new Error('COSE signature invalid over reconstructed root');
  }
  return { size, index };
}

const attempt = (fn) => { try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, error: e.message }; } };

// ═══ run ═════════════════════════════════════════════════════════════════════════════════════════
const A = FIX.artifact;
const bindings = Object.fromEntries(A.anchor_bindings.map((x) => [x.type, x]));

// §20 scope: bindings + supersedes ride OUTSIDE the execution_hash preimage
const recomputed = await executionHash(A.policy_parameters, A.output_payload);
ok(recomputed === A.execution_hash, '(e) execution_hash recomputes with anchor_bindings + supersedes attached (outside hash scope)');
ok(Array.isArray(A.supersedes) && A.supersedes.every((s) => /^sha256:[0-9a-f]{64}$/.test(s)), 'supersedes is an array of sha256:-prefixed hashes (§1 rider)');

// (a) rfc3161-tst — real FreeTSA token vs pinned root
const rfc = bindings['rfc3161-tst'];
ok(await bindingHashOk(rfc, A), '(a) rfc3161 binding anchored_hash == recomputed execution_hash');
const rfcRes = attempt(() => verifyRfc3161(rfc, { rootPem: FIX.pinned.freetsa_root_pem, expectHashHex: bareHash(rfc.anchored_hash) }));
ok(rfcRes.ok, `(a) REAL TST verifies offline against the pinned FreeTSA root${rfcRes.ok ? ` (policy ${rfcRes.value.policyOid}, genTime ${rfcRes.value.genTime})` : ` [${rfcRes.error}]`}`);

// (e) rfc3161 tamper: flip a byte in the CMS signature value (trailing bytes of SignerInfo)
{
  const bad = structuredClone(rfc);
  const raw = b64(bad.proof);
  raw[raw.length - 4] ^= 0x01;
  bad.proof = raw.toString('base64');
  const r = attempt(() => verifyRfc3161(bad, { rootPem: FIX.pinned.freetsa_root_pem, expectHashHex: bareHash(bad.anchored_hash) }));
  ok(!r.ok, '(e) rfc3161 tampered CMS signature fails');
}
// (e) rfc3161 tamper: flip a byte inside TSTInfo (breaks signedAttrs messageDigest binding)
{
  const bad = structuredClone(rfc);
  const raw = b64(bad.proof);
  // locate the TSTInfo eContent inside the token and poison one byte of it
  const ci = derRead(raw, 0);
  const sd = derChildrenOf(raw, derChildrenOf(raw, ci)[1])[0];
  const encapKids = derChildrenOf(raw, derChildrenOf(raw, sd)[2]);
  const octets = derRead(raw, encapKids[1].start);
  raw[octets.start + 40] ^= 0x01;
  bad.proof = raw.toString('base64');
  const r = attempt(() => verifyRfc3161(bad, { rootPem: FIX.pinned.freetsa_root_pem, expectHashHex: bareHash(bad.anchored_hash) }));
  ok(!r.ok, '(e) rfc3161 tampered TSTInfo fails (messageDigest binding)');
}
// (e) rfc3161 mismatched anchored_hash
{
  const bad = structuredClone(rfc);
  bad.anchored_hash = 'sha256:' + '0'.repeat(64);
  ok(!(await bindingHashOk(bad, A)), '(e) rfc3161 mismatched anchored_hash rejected at binding level');
  const r = attempt(() => verifyRfc3161(bad, { rootPem: FIX.pinned.freetsa_root_pem, expectHashHex: bareHash(bad.anchored_hash) }));
  ok(!r.ok, '(e) rfc3161 messageImprint check also fails on the mismatched hash');
}

// (b) opentimestamps — completed vector vs pinned block header data
const V = FIX.ots_vector;
const otsRes = attempt(() => verifyOts(b64(V.ots_b64), { expectFileSha256: V.file_sha256, pinnedHeight: V.bitcoin_height, pinnedMerkleRootDisplay: V.merkle_root_display }));
ok(otsRes.ok, `(b) completed OTS vector verifies against pinned Bitcoin block ${V.bitcoin_height}${otsRes.ok ? '' : ` [${otsRes.error}]`}`);
ok(bareHash(V.binding.anchored_hash) === V.file_sha256, '(b) OTS binding anchored_hash matches the proof-committed digest');
// (e) ots tamper: flip a byte in the op chain
{
  const raw = b64(V.ots_b64);
  raw[raw.length - 40] ^= 0x01;
  const r = attempt(() => verifyOts(raw, { expectFileSha256: V.file_sha256, pinnedHeight: V.bitcoin_height, pinnedMerkleRootDisplay: V.merkle_root_display }));
  ok(!r.ok, '(e) OTS tampered proof fails');
}
// (e) ots binding against OUR artifact = mismatched anchored_hash MUST fail at binding level
ok(!(await bindingHashOk(V.binding, A)), '(e) OTS vector binding rejected against a different artifact (anchored_hash != execution_hash)');

// (c) c2sp-tlog-proof-v1 — pinned TEST log key + 2 cosigners
const c2sp = bindings['c2sp-tlog-proof-v1'];
ok(await bindingHashOk(c2sp, A), '(c) c2sp binding anchored_hash == recomputed execution_hash');
const c2spRes = attempt(() => verifyC2sp(c2sp, FIX.pinned.c2sp));
ok(c2spRes.ok, `(c) tlog-proof@v1 verifies (checkpoint sig + 2 cosigs + inclusion)${c2spRes.ok ? ` (tree size ${c2spRes.value.size}, index ${c2spRes.value.index})` : ` [${c2spRes.error}]`}`);
// (e) c2sp tamper: corrupt the checkpoint root line (breaks the log signature)
{
  const bad = structuredClone(c2sp);
  bad.proof = bad.proof.replace(/^([^\n]*\n[^\n]*\n)([A-Za-z0-9+/=]+)\n/m, (all, pre, r) => pre + Buffer.from(sha256(Buffer.from(r))).toString('base64') + '\n');
  const r = attempt(() => verifyC2sp(bad, FIX.pinned.c2sp));
  ok(!r.ok, '(e) c2sp tampered checkpoint fails');
}
// (e) c2sp tamper: swap one inclusion-path hash
{
  const bad = structuredClone(c2sp);
  const ls = bad.proof.split('\n');
  ls[2] = Buffer.from(sha256(Buffer.from('poison'))).toString('base64');
  bad.proof = ls.join('\n');
  const r = attempt(() => verifyC2sp(bad, FIX.pinned.c2sp));
  ok(!r.ok, '(e) c2sp tampered inclusion path fails');
}
// (e) c2sp mismatched anchored_hash: the leaf no longer matches the proven one
{
  const bad = structuredClone(c2sp);
  bad.anchored_hash = 'sha256:' + '1'.repeat(64);
  const r = attempt(() => verifyC2sp(bad, FIX.pinned.c2sp));
  ok(!r.ok && !(await bindingHashOk(bad, A)), '(e) c2sp mismatched anchored_hash fails inclusion + binding checks');
}

// (d) scitt-receipt-rfc9942 — COSE receipt under the pinned test key
const scitt = bindings['scitt-receipt-rfc9942'];
ok(await bindingHashOk(scitt, A), '(d) scitt binding anchored_hash == recomputed execution_hash');
const scittRes = attempt(() => verifyScitt(scitt, FIX.pinned.scitt));
ok(scittRes.ok, `(d) COSE receipt verifies (RFC9162_SHA256 inclusion + EdDSA Sig_structure)${scittRes.ok ? '' : ` [${scittRes.error}]`}`);
// (e) scitt tamper: flip a signature byte
{
  const bad = structuredClone(scitt);
  const raw = b64(bad.proof);
  raw[raw.length - 5] ^= 0x01;
  bad.proof = raw.toString('base64');
  const r = attempt(() => verifyScitt(bad, FIX.pinned.scitt));
  ok(!r.ok, '(e) scitt tampered signature fails');
}
// (e) scitt mismatched anchored_hash: leaf changes, root changes, signature fails
{
  const bad = structuredClone(scitt);
  bad.anchored_hash = 'sha256:' + '2'.repeat(64);
  const r = attempt(() => verifyScitt(bad, FIX.pinned.scitt));
  ok(!r.ok && !(await bindingHashOk(bad, A)), '(e) scitt mismatched anchored_hash fails receipt + binding checks');
}

// schema-shape sanity for the rfc3161 REQUIRED members (§20 / anchorBinding oneOf)
ok(['policy_oid', 'serial', 'gen_time', 'signer_cert_chain_b64'].every((k) => rfc[k] !== undefined), 'rfc3161 binding carries all four REQUIRED additional members');

// ── (f) §20 merkle_inclusion (v0.8) — batch anchoring: exec_hash is a LEAF, anchored_hash is ROOT ──
// OFFLINE fixture: synthesize a small RFC 6962 tree over deterministic test hashes (no network),
// pick one leaf as "our" artifact, build its inclusion proof, and set anchored_hash = tree root.
// Reuses the shipped leafHash/mth/auditPath/rootFromInclusion (no second Merkle implementation).
{
  const TREE_N = 6;                                   // deliberately non-power-of-two
  const execHashes = Array.from({ length: TREE_N }, (_, i) => sha256(Buffer.from('ocg-v0.8-merkle-leaf-' + i)).toString('hex'));
  const leafHashes = execHashes.map((h) => leafHash(Buffer.from(h, 'hex')));
  const root = mth(leafHashes);
  const K = 3;                                        // the artifact we hold is leaf #3
  const path = auditPath(K, leafHashes);
  const execHashHex = execHashes[K];
  const anchoredHashHex = root.toString('hex');
  const mi = {
    leaf: execHashHex,
    index: K,
    path: path.map((b) => b.toString('hex')),
    tree_size: TREE_N,
    algorithm: 'rfc6962',
  };
  // A synthetic artifact whose execution_hash is the leaf, carrying a merkle-inclusion binding.
  const mArtifact = { execution_hash: execHashHex };
  const okInc = attempt(() => verifyMerkleInclusion(mi, { anchoredHashHex, execHashHex: mArtifact.execution_hash }));
  ok(okInc.ok && okInc.value.rootHex === anchoredHashHex, `(f) merkle_inclusion reconstructs the anchored root from leaf+path (tree_size ${TREE_N}, index ${K})`);
  // sanity: the root actually equals the direct MTH over all leaves
  ok(anchoredHashHex === mth(leafHashes).toString('hex'), '(f) synthesized RFC 6962 root is the tree MTH');
  // (e) tamper: corrupt one path node -> root no longer equals anchored_hash
  {
    const bad = { ...mi, path: [...mi.path] };
    bad.path[0] = sha256(Buffer.from('poison')).toString('hex');
    const r = attempt(() => verifyMerkleInclusion(bad, { anchoredHashHex, execHashHex }));
    ok(!r.ok, '(f) merkle_inclusion tampered path fails (root != anchored_hash)');
  }
  // (e) leaf != artifact execution_hash MUST fail
  {
    const r = attempt(() => verifyMerkleInclusion(mi, { anchoredHashHex, execHashHex: 'f'.repeat(64) }));
    ok(!r.ok, '(f) merkle_inclusion leaf != artifact execution_hash rejected');
  }
  // (e) mismatched anchored_hash (wrong root) MUST fail
  {
    const r = attempt(() => verifyMerkleInclusion(mi, { anchoredHashHex: '0'.repeat(64), execHashHex }));
    ok(!r.ok, '(f) merkle_inclusion wrong anchored_hash rejected');
  }
  // wrong index (proof no longer reconstructs) MUST fail
  {
    const r = attempt(() => verifyMerkleInclusion({ ...mi, index: 0 }, { anchoredHashHex, execHashHex }));
    ok(!r.ok, '(f) merkle_inclusion wrong index rejected');
  }
}

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all anchor-binding assertions passed');
process.exit(fail ? 1 : 0);
