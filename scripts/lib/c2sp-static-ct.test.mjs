#!/usr/bin/env node
// c2sp-static-ct.test.mjs -- coverage for scripts/lib/c2sp-static-ct.mjs.
//
// Two vectors:
//  1. SYNTHETIC (always runs): a 600-entry static-ct-shaped log built in this
//     file with a freshly generated ECDSA P-256 key. Exercises full and partial
//     tiles at two levels and the signature path.
//  2. CAPTURED (runs when the workspace capture is present): the real Let's
//     Encrypt Willow2026h2 checkpoint (tree size 1073111215) with the tiles for
//     leaf 1073108198, from research/clause-snapshots/static-ct/. The capture
//     lives outside this repo, so CI without it reports SKIP, never a pass.
//     Point STATIC_CT_VECTOR_DIR at the directory to force a location.
//
// Zero network: fetch is poisoned for the whole run.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  hashLeafNode, hashInteriorNode, bytesToBase64, base64ToBytes, concatBytes,
} from '../../chaingraph/kernels/c2sp-tlog-verify.mjs';
import {
  parseStaticCtCheckpoint, verifyStaticCtCheckpointSignature, staticCtKeyId,
  encodeTileIndex, tileWidthForSize, hashTilePath, dataTilePath, parseTilePath,
  decodeLeafIndexExtension, parseDataTile, verifyStaticCtEntry, mtcTlogDraft,
} from './c2sp-static-ct.mjs';

globalThis.fetch = () => { throw new Error('network call attempted'); };

let passed = 0, failed = 0, skipped = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ok   ' + name); passed++; }
  catch (e) { console.error('  FAIL ' + name + ' -- ' + e.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function refused(fn, label) {
  try { await fn(); } catch { return; }
  throw new Error(label + ' was accepted');
}

// ---- tile path unit checks (spec examples) ----------------------------------
await test('tile index encoding matches the tlog-tiles example', () => {
  assert(encodeTileIndex(1234067) === 'x001/x234/067');
  assert(encodeTileIndex(0) === '000');
  assert(encodeTileIndex(4191828) === 'x004/x191/828');
});
await test('partial widths follow floor(size/256^L) mod 256 (spec: size 70000)', () => {
  assert(tileWidthForSize(70000, 0, 273) === 112);
  assert(tileWidthForSize(70000, 0, 272) === 256);
  assert(tileWidthForSize(70000, 1, 1) === 17);
  assert(tileWidthForSize(70000, 2, 0) === 1);
  assert(hashTilePath(0, 273, 70000) === 'tile/0/273.p/112');
  assert(tileWidthForSize(256, 1, 0) === 1, 'size 256 has a level-1 tile of width 1');
  let threw = false; try { tileWidthForSize(70000, 0, 274); } catch { threw = true; }
  assert(threw, 'tile past the right edge must not exist');
});
await test('parseTilePath round-trips and refuses malformed paths', () => {
  const p = parseTilePath('tile/0/x004/x191/840.p/175');
  assert(p.kind === 'hash' && p.level === 0 && p.index === 4191840 && p.width === 175 && p.partial);
  assert(parseTilePath('tile/data/x004/x191/828').kind === 'data');
  assert(parseTilePath('tile/6/000') === null);
  assert(parseTilePath('tile/0/12') === null);
  assert(parseTilePath('tile/0/000.p/256') === null);
});
await test('leaf_index extension decodes uint40 and refuses bad shapes', () => {
  assert(decodeLeafIndexExtension(Uint8Array.from([0, 0, 5, 0, 0x3f, 0xf6, 0x54, 0xe6])) === 1073108198);
  assert(decodeLeafIndexExtension(new Uint8Array(0)) === null);
  let n = 0;
  for (const bad of [[0, 0, 4, 0, 0, 0, 1], [0, 0, 5, 0, 0, 0], [0, 0, 1, 7, 0, 0, 1, 8]]) {
    try { decodeLeafIndexExtension(Uint8Array.from(bad)); } catch { n++; }
  }
  assert(n === 3, 'short, truncated and duplicate extensions must throw');
});
await test('mtc-tlog leg is flagged draft and names follow the spec examples', () => {
  assert(mtcTlogDraft.draft === true);
  assert(mtcTlogDraft.cosignerName('32473.1') === 'oid/1.3.6.1.4.1.32473.1');
  assert(mtcTlogDraft.logOrigin('32473.2', 42) === 'oid/1.3.6.1.4.1.32473.2.0.42');
  assert(mtcTlogDraft.logPrefixUrl('https://ca.example/', 42) === 'https://ca.example/42');
});

// ---- 1. synthetic vector ----------------------------------------------------
const N = 600;
const ORIGIN = 'ct.example.test/2026h2';
const u = (...a) => Uint8Array.from(a);
function be(n, bytes) { const o = new Uint8Array(bytes); for (let i = bytes - 1; i >= 0; i--) { o[i] = n % 256; n = Math.floor(n / 256); } return o; }
function tileLeaf(i) {
  const cert = new TextEncoder().encode('synthetic-cert-' + i);
  return concatBytes([be(1700000000000 + i, 8), be(0, 2), be(cert.length, 3), cert, be(8, 2), u(0, 0, 5), be(i, 5), be(0, 2)]);
}
async function mthOf(hashes) {
  if (hashes.length === 1) return hashes[0];
  let k = 1; while (k * 2 < hashes.length) k *= 2;
  return hashInteriorNode(await mthOf(hashes.slice(0, k)), await mthOf(hashes.slice(k)));
}
function rawToDer(raw) {
  const enc = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; v = v.subarray(i); if (v[0] & 0x80) v = concatBytes([u(0), v]); return concatBytes([u(2, v.length), v]); };
  const body = concatBytes([enc(raw.subarray(0, 32)), enc(raw.subarray(32))]);
  return concatBytes([u(0x30, body.length), body]);
}

const leaves = Array.from({ length: N }, (_, i) => tileLeaf(i));
const leafHashes = [];
for (const l of leaves) {
  // TimestampedEntry is everything up to and including the extensions field.
  const te = l.subarray(0, l.length - 2);
  leafHashes.push(await hashLeafNode(concatBytes([u(0, 0), te])));
}
const root = await mthOf(leafHashes);
const tiles = {};
const cat = (arr) => concatBytes(arr);
tiles[hashTilePath(0, 0, N)] = cat(leafHashes.slice(0, 256));
tiles[hashTilePath(0, 1, N)] = cat(leafHashes.slice(256, 512));
tiles[hashTilePath(0, 2, N)] = cat(leafHashes.slice(512));
tiles[hashTilePath(1, 0, N)] = cat([await mthOf(leafHashes.slice(0, 256)), await mthOf(leafHashes.slice(256, 512))]);
tiles[dataTilePath(0, N)] = cat(leaves.slice(0, 256));
tiles[dataTilePath(1, N)] = cat(leaves.slice(256, 512));
tiles[dataTilePath(2, N)] = cat(leaves.slice(512));

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey));
const logId = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
async function signedCheckpoint(size, rootHash, ts = 1700000999000) {
  const msg = new Uint8Array(2 + 8 + 8 + 32);
  const dv = new DataView(msg.buffer);
  dv.setUint8(1, 1); dv.setBigUint64(2, BigInt(ts)); dv.setBigUint64(10, BigInt(size)); msg.set(rootHash, 18);
  const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, msg));
  const der = rawToDer(raw);
  const body = concatBytes([be(ts, 8), u(4, 3), be(der.length, 2), der]);
  const keyId = Uint8Array.from((await staticCtKeyId(ORIGIN, logId)).match(/../g).map((h) => parseInt(h, 16)));
  return `${ORIGIN}\n${size}\n${bytesToBase64(rootHash)}\n\n— grease.invalid ${bytesToBase64(u(1, 2, 3, 4, 5))}\n— ${ORIGIN} ${bytesToBase64(concatBytes([keyId, body]))}\n`;
}
const cpText = await signedCheckpoint(N, root);

await test('synthetic: parse, signature, tiles, proof and leaf_index all verify (full + partial tiles)', async () => {
  for (const index of [0, 255, 256, 511, 512, 599]) {
    const r = await verifyStaticCtEntry({ checkpointText: cpText, index, tiles, logKeySpki: spki, logId });
    assert(r.ok === true, `index ${index}: ${JSON.stringify(r)}`);
  }
});
await test('synthetic: a single TileLeaf can stand in for the data tile', async () => {
  const r = await verifyStaticCtEntry({ checkpointText: cpText, index: 530, tiles, entryBytes: leaves[530], logKeySpki: spki, logId });
  assert(r.ok === true, JSON.stringify(r));
});
await test('synthetic: one altered level-0 tile hash fails', async () => {
  const bad = { ...tiles };
  const t = bad[hashTilePath(0, 2, N)].slice();
  t[40] ^= 0x01;
  bad[hashTilePath(0, 2, N)] = t;
  const r = await verifyStaticCtEntry({ checkpointText: cpText, index: 530, tiles: bad, logKeySpki: spki, logId });
  assert(r.ok === false && (r.rootFromTiles === false || r.inclusion === false || r.leafHashMatchesTile === false), JSON.stringify(r));
});
await test('synthetic: one altered upper-level tile hash fails', async () => {
  const bad = { ...tiles };
  const t = bad[hashTilePath(1, 0, N)].slice();
  t[0] ^= 0x80;
  bad[hashTilePath(1, 0, N)] = t;
  const r = await verifyStaticCtEntry({ checkpointText: cpText, index: 3, tiles: bad, logKeySpki: spki, logId });
  assert(r.ok === false && r.rootFromTiles === false, JSON.stringify(r));
});
await test('synthetic: a wrong leaf_index extension fails', async () => {
  const forged = leaves[10].slice();
  forged[forged.length - 2 - 1] ^= 0x01; // low byte of the uint40
  const r = await verifyStaticCtEntry({ checkpointText: cpText, index: 10, tiles, entryBytes: forged, logKeySpki: spki, logId });
  assert(r.ok === false && r.leafIndexExtension === false, JSON.stringify(r));
});
await test('synthetic: a tampered signature or wrong key is refused', async () => {
  const cp = parseStaticCtCheckpoint(cpText);
  const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const otherSpki = new Uint8Array(await crypto.subtle.exportKey('spki', other.publicKey));
  const wrongKey = await verifyStaticCtCheckpointSignature(cp, { logKeySpki: otherSpki, logId });
  assert(wrongKey.ok === false);
  const wrongRoot = parseStaticCtCheckpoint(cpText.replace(bytesToBase64(root), bytesToBase64(leafHashes[0])));
  const r = await verifyStaticCtCheckpointSignature(wrongRoot, { logKeySpki: spki, logId });
  assert(r.ok === false, 'signature must not cover a different root');
});
await test('malformed checkpoints are refused', async () => {
  const good = cpText;
  const cases = {
    empty: '',
    'no blank separator': good.replace('\n\n', '\n'),
    'size not a number': good.replace(`\n${N}\n`, '\nsix hundred\n'),
    'size with leading zero': good.replace(`\n${N}\n`, `\n0${N}\n`),
    'size zero': good.replace(`\n${N}\n`, '\n0\n'),
    'root too short': good.replace(bytesToBase64(root), bytesToBase64(root.subarray(0, 31))),
    'origin with space': good.replace(ORIGIN, 'ct.example.test /2026h2'),
    'too few lines': 'a\n1\n',
  };
  for (const [name, text] of Object.entries(cases)) await refused(() => parseStaticCtCheckpoint(text), name);
  const r = await verifyStaticCtEntry({ checkpointText: 'garbage', index: 0, tiles });
  assert(r.ok !== true && r.checkpoint === false && r.errors.length === 1, 'end to end must report a refused checkpoint');
});
await test('a truncated data tile is refused', async () => {
  await refused(() => parseDataTile(tiles[dataTilePath(0, N)].subarray(0, 100)), 'truncated data tile');
});

// ---- 2. captured vector -----------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const dirs = [process.env.STATIC_CT_VECTOR_DIR,
  path.resolve(here, '../../../../research/clause-snapshots/static-ct'),
  path.resolve(here, '../../../research/clause-snapshots/static-ct')].filter(Boolean);
const dir = dirs.find((d) => existsSync(path.join(d, 'checkpoint')));
if (!dir) {
  console.log('  SKIP captured Willow2026h2 vector: workspace capture not present (set STATIC_CT_VECTOR_DIR)');
  skipped++;
} else {
  const capTiles = {};
  for (const p of ['tile/data/x004/x191/828', 'tile/0/x004/x191/828', 'tile/0/x004/x191/840.p/175', 'tile/1/x016/374.p/96', 'tile/2/063.p/246', 'tile/3/000.p/63']) {
    capTiles[p] = new Uint8Array(readFileSync(path.join(dir, p)));
  }
  const capCp = readFileSync(path.join(dir, 'checkpoint'), 'utf8');
  const capSpki = base64ToBytes('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEp8wH8R6zfM+UhsQq5un+lPdNTDkzcgkWLi1DwyqU6T00mtP5/CuGjvpw4mIz89I6KV5ZvhRHt5ZTF6qe24pqiA==');
  const capLogId = base64ToBytes('qCbL4wrGNRJGUz/gZfFPGdluGQgTxB3ZbXkAsxI8VSc=');
  const INDEX = 1073108198;
  await test('captured: real Willow2026h2 checkpoint, signature, tiles, 27-hash proof and leaf_index verify', async () => {
    const r = await verifyStaticCtEntry({ checkpointText: capCp, index: INDEX, tiles: capTiles, logKeySpki: capSpki, logId: capLogId });
    assert(r.ok === true, JSON.stringify(r));
    assert(r.proofLength === 27, 'proof length ' + r.proofLength);
    assert(r.checkpoint.size === 1073111215);
    assert(r.signature.ok === true);
  });
  await test('captured: one altered partial-tile hash fails', async () => {
    const bad = { ...capTiles };
    const t = bad['tile/1/x016/374.p/96'].slice();
    t[3000] ^= 0x01;
    bad['tile/1/x016/374.p/96'] = t;
    const r = await verifyStaticCtEntry({ checkpointText: capCp, index: INDEX, tiles: bad, logKeySpki: capSpki, logId: capLogId });
    assert(r.ok === false, 'altered tile hash must not verify');
  });
  await test('captured: a malformed copy of the real checkpoint is refused', async () => {
    await refused(() => parseStaticCtCheckpoint(capCp.replace('1073111215', '10731112x5')), 'bad size');
    await refused(() => parseStaticCtCheckpoint(capCp.split('\n\n')[0]), 'unsigned note');
  });
}

console.log(`\nc2sp-static-ct: ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
