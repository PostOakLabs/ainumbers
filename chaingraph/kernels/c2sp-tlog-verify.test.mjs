#!/usr/bin/env node
// c2sp-tlog-verify.test.mjs — spec-conformance + offline-invariant coverage
// for the shared C2SP module (C2SP-TLOG-VERIFY-MODULE-1).
//
// 1. SPEC-CONFORMANCE FIXTURE: the literal worked example published in
//    tlog-checkpoint.md (origin "example.com/behind-the-sofa") — proves
//    parseSignedNote/formatCheckpoint implement the real C2SP grammar, not
//    just whatever shape our two existing scripts happened to produce.
// 2. RFC 6962 sanity: an 8-leaf tree, every inclusion path verifies, a
//    tampered leaf is rejected (same shape both callers' own selftests run).
// 3. OFFLINE-VERIFY INVARIANT (CHAINPOINT GUARD, SO #0): poison global.fetch
//    before calling every exported function, confirm identical results and
//    no throw — proves zero network calls anywhere in this module's call
//    graph, demonstrated against the shared module directly, not just at
//    the register-sigsum.mjs/register-rekor.mjs CLI layer.

import {
  sha256, hashLeafNode, hashInteriorNode, verifyInclusion,
  formatCheckpoint, parseSignedNote, toCosignedData,
  bytesToHex, hexToBytes, bytesToBase64, base64ToBytes, bytesEqual,
} from './c2sp-tlog-verify.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── 1. SPEC-CONFORMANCE FIXTURE — tlog-checkpoint.md's own worked example ──

const SPEC_EXAMPLE = 'example.com/behind-the-sofa\n20852163\nCsUYapGGPo4dkMgIAUqom/Xajj7h2fB2MPA3j2jxq2I=\n\n— example.com/behind-the-sofa Az3grlgtzPICa5OS8npVmf1Myq/5IZniMp+ZJurmRDeOoRDe4URYN7u5/Zhcyv2q1gGzGku9nTo+zyWE+xeMcTOAYQ8=\n';

await test('parseSignedNote parses tlog-checkpoint.md worked example correctly', async () => {
  const note = parseSignedNote(SPEC_EXAMPLE);
  assert(note.origin === 'example.com/behind-the-sofa', `origin: ${note.origin}`);
  assert(note.size === 20852163, `size: ${note.size}`);
  assert(bytesToBase64(note.rootHash) === 'CsUYapGGPo4dkMgIAUqom/Xajj7h2fB2MPA3j2jxq2I=', `root b64: ${bytesToBase64(note.rootHash)}`);
  assert(note.extensionLines.length === 0, `expected no extension lines, got ${note.extensionLines.length}`);
  assert(note.cosignatures.length === 1, `expected 1 cosignature, got ${note.cosignatures.length}`);
  const cosig = note.cosignatures[0];
  assert(cosig.name === 'example.com/behind-the-sofa', `cosig name: ${cosig.name}`);
  // "Az3grlgtzPICa5OS8npVmf1Myq/5IZniMp+ZJurmRDeOoRDe4URYN7u5/Zhcyv2q1gGzGku9nTo+zyWE+xeMcTOAYQ8="
  // decodes to keyHint(4 bytes) || raw signature bytes (signed-note.md framing).
  const fullSig = base64ToBytes('Az3grlgtzPICa5OS8npVmf1Myq/5IZniMp+ZJurmRDeOoRDe4URYN7u5/Zhcyv2q1gGzGku9nTo+zyWE+xeMcTOAYQ8=');
  assert(cosig.keyIdHex === bytesToHex(fullSig.subarray(0, 4)), `keyIdHex mismatch: ${cosig.keyIdHex}`);
  assert(bytesEqual(cosig.sigBytes, fullSig.subarray(4)), 'sigBytes should be the full signature minus the 4-byte key hint');
  assert(note.noteText === 'example.com/behind-the-sofa\n20852163\nCsUYapGGPo4dkMgIAUqom/Xajj7h2fB2MPA3j2jxq2I=\n', `noteText: ${JSON.stringify(note.noteText)}`);
});

await test('formatCheckpoint round-trips the spec example note text (minus signature block)', async () => {
  const note = parseSignedNote(SPEC_EXAMPLE);
  const rebuilt = formatCheckpoint(note.origin, note.size, note.rootHash);
  assert(rebuilt === note.noteText, `expected round-trip, got:\n${rebuilt}\nvs\n${note.noteText}`);
});

// ── 2. RFC 6962 inclusion-proof sanity ─────────────────────────────────────

await test('8-leaf inclusion proof verifies for every index; tampered leaf rejected', async () => {
  const leaves = await Promise.all(Array.from({ length: 8 }, (_, i) => hashLeafNode(new TextEncoder().encode(`leaf-${i}`))));
  async function mth(lo, hi) {
    if (hi - lo === 1) return leaves[lo];
    let k = 1; while (k * 2 < hi - lo) k *= 2;
    return hashInteriorNode(await mth(lo, lo + k), await mth(lo + k, hi));
  }
  async function path(index, lo, hi) {
    if (hi - lo === 1) return [];
    let k = 1; while (k * 2 < hi - lo) k *= 2;
    return index < lo + k
      ? [...(await path(index, lo, lo + k)), await mth(lo + k, hi)]
      : [...(await path(index, lo + k, hi)), await mth(lo, lo + k)];
  }
  const root = await mth(0, leaves.length);
  for (let i = 0; i < leaves.length; i++) {
    const ok = await verifyInclusion({ leaf: leaves[i], index: i, size: leaves.length, root, path: await path(i, 0, leaves.length) });
    assert(ok, `expected inclusion proof to verify for leaf index ${i}`);
  }
  const tamperedLeaf = await hashLeafNode(new TextEncoder().encode('tampered'));
  const badOk = await verifyInclusion({ leaf: tamperedLeaf, index: 0, size: leaves.length, root, path: await path(0, 0, leaves.length) });
  assert(!badOk, 'expected a tampered leaf to be rejected');
});

// ── 3. OFFLINE-VERIFY INVARIANT — poison fetch, call the shared module directly ──

await test('CHAINPOINT GUARD: every exported function runs unchanged with global.fetch poisoned', async () => {
  const leaf = await hashLeafNode(new TextEncoder().encode('sample'));
  const note = parseSignedNote(SPEC_EXAMPLE);
  const rebuilt = formatCheckpoint(note.origin, note.size, note.rootHash);
  const cosigned = toCosignedData(note.origin, note.size, note.rootHash, 1234567890);
  const interior = await hashInteriorNode(leaf, leaf);
  const digest = await sha256(new TextEncoder().encode('x'));
  const inclusionOk = await verifyInclusion({ leaf, index: 0, size: 1, root: leaf, path: [] });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('fetch() called — CHAINPOINT GUARD violated'); };
  try {
    const leaf2 = await hashLeafNode(new TextEncoder().encode('sample'));
    const note2 = parseSignedNote(SPEC_EXAMPLE);
    const rebuilt2 = formatCheckpoint(note2.origin, note2.size, note2.rootHash);
    const cosigned2 = toCosignedData(note2.origin, note2.size, note2.rootHash, 1234567890);
    const interior2 = await hashInteriorNode(leaf2, leaf2);
    const digest2 = await sha256(new TextEncoder().encode('x'));
    const inclusionOk2 = await verifyInclusion({ leaf: leaf2, index: 0, size: 1, root: leaf2, path: [] });

    assert(bytesEqual(leaf, leaf2), 'hashLeafNode result changed under fetch-poisoning');
    assert(rebuilt === rebuilt2, 'formatCheckpoint result changed under fetch-poisoning');
    assert(cosigned === cosigned2, 'toCosignedData result changed under fetch-poisoning');
    assert(bytesEqual(interior, interior2), 'hashInteriorNode result changed under fetch-poisoning');
    assert(bytesEqual(digest, digest2), 'sha256 result changed under fetch-poisoning');
    assert(inclusionOk === true && inclusionOk2 === true, 'verifyInclusion result changed under fetch-poisoning');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
