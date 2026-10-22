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
  rec('SKIP', set, 'mldsa44-0x06', 'no independent ML-DSA-44 (0x06) cosignature vector found as of 2026-10-22 (see PROVENANCE.json)');
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

// ── driver ────────────────────────────────────────────────────────────────────────────────
await runMerkle();
await runCosignature();
await runBitstring();
await runCid();

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
