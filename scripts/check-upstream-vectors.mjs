#!/usr/bin/env node
// Advisory conformance harness: runs shipped verifiers against vendored third-party test vectors.
// Vectors are test DATA only (chaingraph/kernels/__upstream-vectors__/); verifiers are imported read-only.
// Exit 1 on a FAIL missing from scripts/upstream-vectors-baseline.json, or on a baseline entry that now passes.
// Exit 2 on a harness fault (vendored file digest drift, reference control failing).
// Zero dependencies, zero network.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash, createPrivateKey, createPublicKey, verify as edVerify } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = join(REPO, 'chaingraph', 'kernels');
const VDIR = join(KDIR, '__upstream-vectors__');
const BASELINE = join(HERE, 'upstream-vectors-baseline.json');

const results = [];
const rec = (verdict, set, id, reason = '') => results.push({ verdict, set, id, reason });
const fault = (msg) => { console.error('HARNESS FAULT: ' + msg); process.exit(2); };
const b64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const hex = (u8) => Buffer.from(u8).toString('hex');
const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

// Every vendored file must still match its PROVENANCE.json digest before any vector is read.
function checkProvenance(setDir) {
  const prov = JSON.parse(readFileSync(join(VDIR, setDir, 'PROVENANCE.json'), 'utf8'));
  for (const src of prov.sources) {
    for (const f of src.files) {
      const p = join(VDIR, setDir, f.path);
      if (!existsSync(p)) fault(`${setDir}/${f.path} missing`);
      if (sha256hex(readFileSync(p)) !== f.sha256) fault(`${setDir}/${f.path} digest differs from PROVENANCE.json`);
    }
  }
}
const vfile = (rel) => readFileSync(join(VDIR, rel), 'utf8');

function walkJson(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkJson(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// ── (a) RFC 6962 / 9162 Merkle proofs: c2sp-tlog-verify.mjs ───────────────────────────────
async function runMerkle() {
  const set = 'rfc6962-merkle';
  checkProvenance(set);
  const { verifyInclusion, verifyConsistency } = await import(pathToFileURL(join(KDIR, 'c2sp-tlog-verify.mjs')).href);
  const base = join(VDIR, set, 'transparency-dev-merkle', 'testdata');
  for (const kind of ['inclusion', 'consistency']) {
    for (const p of walkJson(join(base, kind))) {
      const v = JSON.parse(readFileSync(p, 'utf8'));
      const id = relative(base, p).replace(/\\/g, '/').replace(/\.json$/, '');
      const wantOk = !v.wantErr;
      let got, thrown = null;
      try {
        got = kind === 'inclusion'
          ? await verifyInclusion({ leaf: b64(v.leafHash), index: v.leafIdx, size: v.treeSize, root: b64(v.root), path: (v.proof ?? []).map(b64) })
          : await verifyConsistency({ oldSize: v.size1, newSize: v.size2, oldRoot: b64(v.root1), newRoot: b64(v.root2), proof: (v.proof ?? []).map(b64) });
      } catch (e) { thrown = e; got = false; }
      if (got === wantOk) rec('PASS', set, id, v.desc);
      else rec('FAIL', set, id, `${v.desc}: wanted ${wantOk ? 'accept' : 'reject'}, verifier ${thrown ? 'threw ' + thrown.message : got ? 'accepted' : 'rejected'}`);
    }
  }
}

// ── (b) C2SP Ed25519 cosignature/v1: art-424 witness verifier ─────────────────────────────
async function runCosignature() {
  const set = 'c2sp-cosignature';
  checkProvenance(set);
  const src = vfile(`${set}/sigsum-go/pkg/checkpoint/checkpoint_test.go`);
  const origin = /testOrigin\s*=\s*"([^"]+)"/.exec(src)?.[1] ?? 'example.org/log';
  const cpAscii = /testCheckpointASCII = `([^`]+)`/.exec(src)?.[1];
  const inputBlock = /input := `\n([\s\S]*?)`\[1:\]/.exec(src)?.[1];
  const ts = Number(/timestamp := uint64\((\d+)\)/.exec(src)?.[1]);
  if (!cpAscii || !inputBlock || !ts) fault('could not extract sigsum-go cosignature vector');
  const [o, size, rootB64] = cpAscii.split('\n');
  if (o !== origin) fault('origin mismatch in sigsum-go vector');
  const body = `${o}\n${size}\n${rootB64}\n`;
  const cosigLine = inputBlock.split('\n')[1]; // upstream comment: "Second line was produced by the test above."
  const [, name, blobB64] = /^— (\S+) (\S+)$/.exec(cosigLine) ?? [];
  if (!name) fault('could not parse sigsum-go cosignature line');
  const blob = Buffer.from(blobB64, 'base64');
  const seedByte = Number(/Ed25519PrivateKey\{(\d+)\}/.exec(src)?.[1]);
  const seed = Buffer.alloc(32); seed[0] = seedByte;
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const pubJwk = createPublicKey(createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })).export({ format: 'jwk' });
  const rawPub = Buffer.from(pubJwk.x, 'base64url');

  // Reference control: the C2SP tlog-cosignature Ed25519 message, verified with node:crypto.
  const specMsg = Buffer.from(`cosignature/v1\ntime ${ts}\n${body}`);
  if (!edVerify(null, specMsg, createPublicKey({ key: pubJwk, format: 'jwk' }), blob.subarray(12))) {
    fault('reference control failed: vendored cosignature does not verify under the C2SP message format');
  }
  const m = await import(pathToFileURL(join(KDIR, 'art-424-witness-cosignature-verifier.kernel.mjs')).href);
  const rootHex = hex(b64(rootB64));
  const mk = (blobBytes) => ({
    anchored_hash: rootHex, log_origin: origin, threshold: 1,
    checkpoint_note: `${body}\n— ${name} ${Buffer.from(blobBytes).toString('base64')}\n`,
    witness_keys: [{ name, algorithm: 'ed25519', public_key_b64: rawPub.toString('base64') }],
  });
  const run = async (id, pp, wantPass, why) => {
    let art;
    try { art = await m.buildArtifact(pp, { now: '2026-10-22T00:00:00Z' }); } catch (e) { rec('FAIL', set, id, 'verifier threw ' + e.message); return; }
    const op = art.output_payload;
    const got = op.witness_verification_result === 'PASS';
    const c = op.cosignatures?.[0];
    if (got === wantPass) rec('PASS', set, id, why);
    else rec('FAIL', set, id, `${why}: wanted ${wantPass ? 'PASS' : 'FAIL'}, got ${op.witness_verification_result} (keyid_match=${c?.keyid_match}, valid=${c?.valid}, structural_error=${op.structural_error})`);
  };
  await run('ed25519-0x04-sigsum-go-valid', mk(blob), true, 'independent sigsum-go cosignature/v1 over a checkpoint');
  const bad = Buffer.from(blob); bad[11] ^= 1; // flip a timestamp bit; upstream rejects this too
  await run('ed25519-0x04-sigsum-go-tampered-timestamp', mk(bad), false, 'timestamp-tampered cosignature must be rejected');
}

// ── (b2) C2SP ML-DSA-44 0x06 cosignature: art-424 witness verifier ────────────────────────
// Vendored vector: torchwood cmd/litewitness/testdata/mldsa.txt — an ML-DSA-44 log key
// cosigning its own checkpoint (generated by torchwood's witnessctl/gentest toolchain over a
// fixed seed; independent of this estate).
async function runMldsaCosignature() {
  const set = 'c2sp-cosignature';
  checkProvenance(set);
  const src = vfile(`${set}/torchwood/cmd/litewitness/testdata/mldsa.txt`);
  const origin = /add-log -origin (\S+)/.exec(src)?.[1];
  const keyMatch = /add-key -origin \S+ -key \S+\+([0-9a-f]{8})\+([A-Za-z0-9+/=]+)/.exec(src);
  const cosigMatch = /\n— (\S+) ([A-Za-z0-9+/=]{200,})/.exec(src);
  const cpMatch = /\n(\S+)\n(\d+)\n([A-Za-z0-9+/=]{44})\n\n— /.exec(src);
  if (!origin || !keyMatch || !cosigMatch || !cpMatch) fault('could not extract torchwood ML-DSA-44 cosignature vector');
  const [, keyTextId, keyB64] = keyMatch;
  const [, cpOrigin, cpSize, rootB64] = cpMatch;
  if (cpOrigin !== origin) fault('origin mismatch in torchwood ML-DSA vector');
  if (cosigMatch[1] !== origin) fault('cosigner name differs from log origin in torchwood ML-DSA vector');
  const keyBytes = b64(keyB64);
  if (keyBytes[0] !== 0x06) fault('torchwood key text does not start with the 0x06 ML-DSA-44 note byte');
  const rawPub = keyBytes.subarray(1); // 1312-byte ML-DSA-44 public key
  const blob = Buffer.from(cosigMatch[2], 'base64');
  if (blob.length !== 12 + 2420) fault(`unexpected ML-DSA-44 cosignature blob length ${blob.length}`);

  // Reference control: our key-id derivation must reproduce torchwood's published key id.
  const derivedId = sha256hex(Buffer.concat([Buffer.from(origin + '\n'), Buffer.from([0x06]), rawPub])).slice(0, 8);
  if (derivedId !== keyTextId) fault(`reference control failed: derived key id ${derivedId} != torchwood key text id ${keyTextId}`);
  if (blob.subarray(0, 4).toString('hex') !== keyTextId) fault('reference control failed: cosignature blob key id differs from key text id');

  const m = await import(pathToFileURL(join(KDIR, 'art-424-witness-cosignature-verifier.kernel.mjs')).href);
  const rootHex = hex(b64(rootB64));
  const mk = (blobBytes, extraLine) => ({
    anchored_hash: rootHex, log_origin: origin, threshold: 1,
    checkpoint_note: `${cpOrigin}\n${cpSize}\n${rootB64}\n${extraLine || ''}\n— ${origin} ${Buffer.from(blobBytes).toString('base64')}\n`,
    witness_keys: [{ name: origin, algorithm: 'ml-dsa-44', public_key_b64: Buffer.from(rawPub).toString('base64') }],
  });
  const run = async (id, pp, wantPass, why) => {
    let art;
    try { art = await m.buildArtifact(pp, { now: '2026-10-24T00:00:00Z' }); } catch (e) { rec('FAIL', set, id, 'verifier threw ' + e.message); return; }
    const op = art.output_payload;
    const got = op.witness_verification_result === 'PASS';
    const c = op.cosignatures?.[0];
    if (got === wantPass) rec('PASS', set, id, why);
    else rec('FAIL', set, id, `${why}: wanted ${wantPass ? 'PASS' : 'FAIL'}, got ${op.witness_verification_result} (keyid_match=${c?.keyid_match}, valid=${c?.valid}, refusal=${c?.refusal ?? 'none'}, structural_error=${op.structural_error})`);
  };
  await run('mldsa44-0x06-torchwood-valid', mk(blob), true, 'independent torchwood ML-DSA-44 0x06 cosignature over a checkpoint');
  const bad = Buffer.from(blob); bad[blob.length - 1] ^= 1; // flip one signature byte
  await run('mldsa44-0x06-torchwood-tampered-sig', mk(bad), false, 'signature-tampered ML-DSA-44 cosignature must be rejected');
  await run('mldsa44-0x06-extension-lines-refused', mk(blob, 'ext.example/v1 some-extension-statement'), false, 'ML-DSA-44 over a note with extension lines must be refused');
}

// ── (c) W3C Bitstring Status List v1.0: art-287 ───────────────────────────────────────────
async function runBitstring() {
  const set = 'w3c-bitstring-status-list';
  checkProvenance(set);
  const html = vfile(`${set}/vc-bitstring-status-list/transitions/2025/REC/index.html.txt`);
  const enc = /"encodedList": "(?:<span[^>]*>)?(u[A-Za-z0-9_-]+)/.exec(html)?.[1];
  const entries = [...html.matchAll(/"statusPurpose": "(revocation|suspension)",\s*"statusListIndex": "(\d+)"/g)].map((x) => ({ purpose: x[1], index: x[2] }));
  const rev = entries.find((e) => e.purpose === 'revocation');
  const sus = entries.find((e) => e.purpose === 'suspension');
  if (!enc || !rev || !sus) fault('could not extract W3C REC examples');
  // Reference decode per the REC algorithm: multibase u (base64url, no pad) -> GZIP -> bitstring, MSB first.
  const bits = gunzipSync(Buffer.from(enc.slice(1), 'base64url'));
  const bitAt = (i) => (bits[Math.floor(i / 8)] >> (7 - (i % 8))) & 1;
  if (bits.length < 16384) fault('reference decode of the REC example list is below the 16KB minimum');
  const m = await import(pathToFileURL(join(KDIR, 'art-287-revocation-status-verifier.kernel.mjs')).href);
  const list = { type: 'BitstringStatusList', statusPurpose: 'revocation', encodedList: enc };
  const url = 'https://example.com/credentials/status/3';

  const run = (id, entry, check, why) => {
    let out;
    try { out = m.compute({ credential_status: { type: 'BitstringStatusListEntry', statusPurpose: entry.purpose, statusListIndex: entry.index, statusListCredential: url }, status_list_credential: list }).output_payload; }
    catch (e) { rec('FAIL', set, id, 'verifier threw ' + e.message); return; }
    const verdict = check(out);
    if (verdict === true) rec('PASS', set, id, why);
    else rec('FAIL', set, id, `${why}: ${verdict}`);
  };
  const wantStatus = bitAt(Number(rev.index)) ? 'revoked' : 'active';
  run('rec-example-revocation-list-multibase-gzip', rev,
    (o) => (o.status === wantStatus && !o.structural_error) || `wanted status ${wantStatus} with no error; got status=${o.status}, structural_error=${JSON.stringify(o.structural_error)}`,
    'REC example entry (string statusListIndex) against the REC multibase-u + GZIP example list');
  run('rec-example-statusPurpose-mismatch', sus,
    (o) => /purpose/i.test(o.structural_error || '') || `wanted a statusPurpose mismatch error (suspension entry vs revocation list); got status=${o.status}, structural_error=${JSON.stringify(o.structural_error)}`,
    'REC verification algorithm: entry purpose must be one of the list purposes');
  run('rec-minimum-length-16KB', rev,
    (o) => o.status === wantStatus || `wanted a ${bits.length}-byte list to be accepted (REC minimum 16KB); got status=${o.status}`,
    'REC: status list is at least 16KB uncompressed (131,072 entries)');
}

// ── (d) CID / CAR: _cid.mjs, _car.mjs ─────────────────────────────────────────────────────
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
function refCidV1(str) { // reference decode of a base32-lower CIDv1; null when not one
  if (!/^b[a-z2-7]+$/.test(str)) return null;
  let acc = 0, nb = 0; const out = [];
  for (const ch of str.slice(1)) { acc = (acc << 5) | B32.indexOf(ch); nb += 5; if (nb >= 8) { nb -= 8; out.push((acc >> nb) & 255); acc &= (1 << nb) - 1; } }
  return Uint8Array.from(out);
}
const readVarint = (b, o) => { let v = 0, s = 0, i = o; for (;;) { const c = b[i++]; v += (c & 127) * 2 ** s; if (!(c & 128)) break; s += 7; } return [v, i]; };
function cidParts(bytes) {
  let [ver, o] = readVarint(bytes, 0); let codec, mh, len;
  [codec, o] = readVarint(bytes, o); [mh, o] = readVarint(bytes, o); [len, o] = readVarint(bytes, o);
  return { ver, codec, mh, len, digest: bytes.slice(o, o + len) };
}

async function runCid() {
  const set = 'multiformats-ipld';
  checkProvenance(set);
  const { toCid, fromCid } = await import(pathToFileURL(join(KDIR, '_cid.mjs')).href);
  const car = await import(pathToFileURL(join(KDIR, '_car.mjs')).href);
  const strings = new Set();
  for (const f of ['js-car/test/test-writer.spec.js', 'js-multiformats/test/test-cid.spec.ts']) {
    for (const x of vfile(`${set}/${f}`).matchAll(/'(b[a-z2-7]{50,})'/g)) strings.add(x[1]);
  }
  for (const cid of [...strings].sort()) {
    const ref = refCidV1(cid); if (!ref) continue;
    const p = cidParts(ref);
    const inProfile = p.ver === 1 && p.codec === 0x55 && p.mh === 0x12 && p.len === 32;
    const id = `cid/${cid}`;
    if (inProfile) {
      let got, thrown = null;
      try { got = fromCid(cid); } catch (e) { thrown = e; }
      const want = 'sha256:' + hex(p.digest);
      if (got === want && toCid(got) === cid) rec('PASS', set, id, 'raw/sha2-256 CIDv1 decodes to the reference digest and re-encodes identically');
      else rec('FAIL', set, id, `wanted ${want}; ${thrown ? 'threw ' + thrown.message : 'got ' + got}`);
    } else {
      let rejected = false; try { fromCid(cid); } catch { rejected = true; }
      if (rejected) rec('PASS', set, id, `profile guard: codec 0x${p.codec.toString(16)} / multihash 0x${p.mh.toString(16)} refused`);
      else rec('FAIL', set, id, `profile guard: codec 0x${p.codec.toString(16)} / multihash 0x${p.mh.toString(16)} was accepted by fromCid`);
    }
  }
  // CAR fixture: only run when its first root is inside the verifier's raw/sha2-256 profile.
  const carBytes = readFileSync(join(VDIR, set, 'js-car/test/fixtures/sample-v1.car'));
  const [hlen, hoff] = readVarint(carBytes, 0);
  const header = carBytes.subarray(hoff, hoff + hlen);
  const tag = header.indexOf(Buffer.from([0xd8, 0x2a, 0x58]));
  if (tag < 0) fault('sample-v1.car header root tag not found');
  const rp = cidParts(header.subarray(tag + 5));
  const id = 'car/sample-v1.car';
  if (rp.ver === 1 && rp.codec === 0x55 && rp.mh === 0x12 && rp.len === 32) {
    try { const r = await car.verifyCar(new Uint8Array(carBytes)); rec(r.ok ? 'PASS' : 'FAIL', set, id, r.ok ? 'CARv1 verified' : 'block digest mismatch'); }
    catch (e) { rec('FAIL', set, id, 'verifyCar threw ' + e.message); }
  } else {
    rec('SKIP', set, id, `root CID codec 0x${rp.codec.toString(16)} / multihash 0x${rp.mh.toString(16)} is outside the _car raw/sha2-256 profile`);
  }
}

// ── (e) RFC 9421 worked examples: art-129 web-bot-auth signature verifier ─────────────────
// Vectors are extracted from the vendored rfc-editor.org plain-text RFC itself
// (Appendix B.1.4 Ed25519 test key, Appendix B.2.6 signed-request example), with an
// RFC 8792 continuation-unwrap before parsing.
function unwrap8792(text) { return text.replace(/\\\r?\n[ \t]+/g, ''); }
function rfcSection(src, startMark, endMark) {
  // lastIndexOf: the section body heading follows the table of contents entry of the same text.
  const i = src.lastIndexOf(startMark);
  if (i < 0) fault(`rfc9421: section marker not found: ${startMark}`);
  const j = src.indexOf(endMark, i);
  if (j < 0) fault(`rfc9421: end marker not found: ${endMark}`);
  return src.slice(i, j);
}
async function runRfc9421() {
  const set = 'rfc9421';
  checkProvenance(set);
  const src = vfile(`${set}/rfc-editor.org/rfc9421.txt`);

  // Appendix B.1.4: Ed25519 test key in JWK form.
  const b14 = unwrap8792(rfcSection(src, 'B.1.4.  Example Ed25519 Test Key', 'B.1.5.'));
  const jwk = JSON.parse(/\{\s*"kty": "OKP"[\s\S]*?\}/.exec(b14)?.[0] ?? 'null');
  if (jwk?.kty !== 'OKP' || jwk.crv !== 'Ed25519') fault('rfc9421: could not extract the Appendix B.1.4 Ed25519 JWK');

  // Appendix B.2.6: signed request with test-key-ed25519.
  const b26 = unwrap8792(rfcSection(src, 'B.2.6.  Signing a Request Using ed25519', 'B.3.'));
  const sigB64 = /Signature: sig-b26=:([A-Za-z0-9+/=]+):/.exec(b26)?.[1];
  const baseBlock = /The corresponding signature base is:([\s\S]*?)This results in/.exec(b26)?.[1] ?? '';
  const baseLines = baseBlock.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'));
  const sigParamsLine = baseLines.find((l) => l.startsWith('"@signature-params": '));
  if (!sigB64 || baseLines.length !== 7 || !sigParamsLine) fault('rfc9421: could not extract the Appendix B.2.6 signature base / signature');

  const covered = baseLines.filter((l) => !l.startsWith('"@signature-params": '))
    .map((l) => { const m = /^"([^"]+)": (.*)$/.exec(l); return { name: m[1], value: m[2] }; });
  const signature_params = sigParamsLine.slice('"@signature-params": '.length);
  const base = baseLines.join('\n');
  const created = Number(/created=(\d+)/.exec(signature_params)?.[1]);
  if (!Number.isFinite(created)) fault('rfc9421: no created timestamp in B.2.6 @signature-params');

  // Reference control: the RFC's own example signature verifies over the RFC's own
  // signature base with node:crypto. If this fails, the vendored text drifted.
  const rawPub = Buffer.from(jwk.x, 'base64url');
  if (!edVerify(null, Buffer.from(base, 'utf8'), createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' }), Buffer.from(sigB64, 'base64'))) {
    fault('reference control failed: RFC 9421 B.2.6 example signature does not verify under node:crypto');
  }

  const m = await import(pathToFileURL(join(KDIR, 'art-129-webbotauth-signature-verifier.kernel.mjs')).href);
  const run = async (id, pp, wantVerdict, why) => {
    let art;
    try { art = await m.buildArtifact(pp, { now: '2026-10-23T00:00:00Z' }); } catch (e) { rec('FAIL', set, id, 'verifier threw ' + e.message); return; }
    const op = art.output_payload;
    if (op.verdict === wantVerdict) rec('PASS', set, id, why);
    else rec('FAIL', set, id, `${why}: wanted verdict ${wantVerdict}, got ${op.verdict} (sig_valid=${op.signature_cryptographically_valid}, tag_ok=${op.tag_ok}, alg_ok=${op.alg_ok})`);
  };
  await run('b2.6-request-ed25519-rfc-example',
    { covered_components: covered, signature_params, signature_b64: sigB64, public_key_jwk: jwk, alg: 'ed25519', created, now_unix: created },
    'ACCEPT', 'RFC 9421 B.2.6 worked example: a cryptographically valid ed25519 request signature');
  const bad = Buffer.from(sigB64, 'base64'); bad[0] ^= 1;
  await run('b2.6-request-ed25519-tampered-signature',
    { covered_components: covered, signature_params, signature_b64: bad.toString('base64'), public_key_jwk: jwk, alg: 'ed25519', created, now_unix: created },
    'REFUSE', 'tampered B.2.6 signature must be refused');
}

// ── (f) did:webvh v1.0 test suite: art-284 did:webvh log verifier ─────────────────────────
async function runDidWebvh() {
  const set = 'didwebvh';
  checkProvenance(set);
  const m = await import(pathToFileURL(join(KDIR, 'art-284-did-webvh-log-verifier.kernel.mjs')).href);
  const base = join(VDIR, set, 'didwebvh-test-suite', 'vectors');
  const defectCode = { // the failure code a conforming verifier should raise per vector family
    'negative-scid-mismatch-genesis': 'ENTRY_HASH_MISMATCH',
    'negative-pre-rotation-omit-updatekeys': 'UPDATE_KEYS_MISSING',
    'negative-wrong-cryptosuite': null,
    'negative-versiontime-future': null,
  };
  for (const name of readdirSync(base).sort()) {
    const dir = join(base, name);
    if (!statSync(dir).isDirectory()) continue;
    const log = vfile(`${set}/didwebvh-test-suite/vectors/${name}/did.jsonl`).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const res = JSON.parse(vfile(`${set}/didwebvh-test-suite/vectors/${name}/resolutionResult.json`));
    const expectedValid = !res.didResolutionMetadata?.error;
    let out;
    try { out = m.compute({ did: log[0]?.state?.id ?? '', did_log: log }).output_payload; }
    catch (e) { rec('FAIL', set, name, 'verifier threw ' + e.message); continue; }
    const codes = out.failures.map((f) => f.code);
    const ok = expectedValid
      ? out.valid === true
      : out.valid === false && (defectCode[name] === undefined || (defectCode[name] && codes.includes(defectCode[name])));
    if (ok) rec('PASS', set, name, `spec outcome ${expectedValid ? 'resolves' : 'rejects'} matched`);
    else rec('FAIL', set, name, `wanted ${expectedValid ? 'valid log' : 'invalid log via ' + (defectCode[name] ?? 'a defect-specific code')}; got valid=${out.valid}, failures=${codes.join(',') || 'none'}`);
  }
}

// ── (g) sanctions list binding (self-authored): art-413 private-input screen ──────────────
async function runSanctionsBinding() {
  const set = 'sanctions-list-binding';
  checkProvenance(set);
  const v = JSON.parse(vfile(`${set}/vectors.json`));
  const m = await import(pathToFileURL(join(KDIR, 'art-413-screen-sanctions-private.kernel.mjs')).href);
  const now = '2026-10-23T00:00:00Z';
  const mk = (parties) => m.buildArtifact({ parties, salt: v.salt_hex, list_version: v.list_version_label }, { now });

  // Control: the verdict math itself functions — hits vs clean differ.
  const hitArt = await mk(v.screened_parties);
  const cleanArt = await mk(v.clean_parties);
  if (hitArt.output_payload.hit_count > 0 && cleanArt.output_payload.hit_count === 0) {
    rec('PASS', set, 'hit-verdict-functional', 'control: hit and clean party sets produce different verdicts');
  } else {
    rec('FAIL', set, 'hit-verdict-functional', `control failed: hit_count=${hitArt.output_payload.hit_count} vs clean hit_count=${cleanArt.output_payload.hit_count}`);
  }

  // The audited property: same parties + same list_version label over two DIFFERENT list
  // contents must yield different receipts. art-413 accepts no list input at all, so the
  // receipt can only distinguish a free label — the two hypothetical list contents A and B
  // are structurally indistinguishable in policy_parameters / output_payload.
  const pubKeys = ['screened', 'hit_count', 'clean', 'coverage', 'list_version', 'regulatory_basis', 'pii_note', 'not_legal_advice'];
  const ppKeys = ['parties_commitment', 'list_version', 'list_source', 'matching_config'];
  const samePublic = (a, b) => pubKeys.every((k) => JSON.stringify(a.output_payload[k]) === JSON.stringify(b.output_payload[k]))
    && ppKeys.every((k) => JSON.stringify(a.policy_parameters[k]) === JSON.stringify(b.policy_parameters[k]));
  const withListA = { ...hitArt }; // parties screened "against" list content A
  const withListB = JSON.parse(JSON.stringify({ ...hitArt })); // identical call: content B cannot be passed in
  if (!samePublic(withListA, withListB)) {
    rec('PASS', set, 'list-version-label-unbound', 'receipt distinguishes list contents under one label');
  } else {
    rec('FAIL', set, 'list-version-label-unbound', 'same parties + same list_version label over two different list contents give an identical receipt: policy_parameters carries only the free list_version label and no list-bytes binding');
  }
}

// ── driver ────────────────────────────────────────────────────────────────────────────────
await runMerkle();
await runCosignature();
await runMldsaCosignature();
await runBitstring();
await runCid();
await runRfc9421();
await runDidWebvh();
await runSanctionsBinding();

for (const r of results) console.log(`${r.verdict} ${r.set} ${r.id}${r.reason ? ' ' + r.reason : ''}`);
const n = (v) => results.filter((r) => r.verdict === v).length;
console.log(`\nTOTAL PASS=${n('PASS')} FAIL=${n('FAIL')} SKIP=${n('SKIP')}`);

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries;
const known = new Map(baseline.map((e) => [e.id, e.reason]));
const key = (r) => `${r.set} ${r.id}`;
const fresh = results.filter((r) => r.verdict === 'FAIL' && !known.has(key(r)));
const stale = [...known.keys()].filter((k) => !results.some((r) => key(r) === k && r.verdict === 'FAIL'));
for (const r of fresh) console.log(`NEW FAIL (not in baseline): ${key(r)}`);
for (const k of stale) console.log(`BASELINE ENTRY NO LONGER FAILS (remove it): ${k}`);
console.log(`baseline: ${known.size} known failure(s); ${fresh.length} new, ${stale.length} stale`);
process.exit(fresh.length || stale.length ? 1 : 0);
