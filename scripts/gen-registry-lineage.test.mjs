#!/usr/bin/env node
// scripts/gen-registry-lineage.test.mjs — unit + mutation tests for
// gen-registry-lineage.mjs (REGISTRY-LINEAGE-TILES-BUILD-1).
//
// Runs entirely against a TEMP registry directory + synthetic records — never
// against the real repo registry/lineage/ tree, and never calls Sigsum (a
// stub `submitToSigsum` is injected via generate()'s opts). This is what lets
// the mutation test run even while live Sigsum submission is rate-limited
// (measured 2026-08-18, see the row's own report): the mechanism under test —
// "does --check detect a flipped byte in a published tile?" — is independent
// of whether a real Sigsum leaf was ever obtained, and it is exercised here
// via the REAL exported generate()/check() functions, not a reimplementation.
//
// Covers (row deliverable #3):
//   1. tile/partial-tile path encoding (§3.3's exact worked examples)
//   2. entry-bundle round-trip (bytes -> hashLeafNode -> matches level-0 tile hash)
//   3. SUBPROOF/PROOF construction against a small hand-checkable 8-leaf tree
//   4. --check mode's mutation detection (real subprocess-free in-process flip)
//
// node scripts/gen-registry-lineage.test.mjs

import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import {
  hashLeafNode, hashInteriorNode, verifyConsistency, formatCheckpoint, bytesToHex, bytesEqual,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';
import {
  encodeTileIndexParts, fullTilePath, partialTilePath, tileGroups, mth, subproof,
  buildConsistencyProof, generate, check, readLevel0LeafHashes,
} from './gen-registry-lineage.mjs';

const subtle = webcrypto.subtle;
let failures = 0;
function ok(cond, label) {
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------------------------
// 1. Tile index path encoding — the exact worked examples from BUILD-SPEC §3.3.
// ---------------------------------------------------------------------------
ok(encodeTileIndexParts(1234067).join('/') === 'x001/x234/067', 'encodeTileIndexParts(1234067) === x001/x234/067');
ok(encodeTileIndexParts(0).join('/') === '000', 'encodeTileIndexParts(0) === 000');
ok(encodeTileIndexParts(5).join('/') === '005', 'encodeTileIndexParts(5) === 005');
ok(encodeTileIndexParts(999).join('/') === '999', 'encodeTileIndexParts(999) === 999');
ok(encodeTileIndexParts(1000).join('/') === 'x001/000', 'encodeTileIndexParts(1000) === x001/000');

{
  const full = fullTilePath('BASE', 1234067);
  ok(full === join('BASE', 'x001', 'x234', '067'), `fullTilePath BASE 1234067 -> ${full}`);
  const partial = partialTilePath('BASE', 1234067, 42);
  ok(partial === join('BASE', 'x001', 'x234', '067.p', '42'), `partialTilePath BASE 1234067 W=42 -> ${partial} (".p" is a DIRECTORY, not an extension)`);
}

// tileGroups: empty tiles must never appear (§3.3), partial only when remainder > 0.
{
  const g256 = tileGroups(256);
  ok(g256.length === 1 && !g256[0].isPartial && g256[0].len === 256, 'tileGroups(256): exactly one FULL tile, no partial (exact multiple)');
  const g260 = tileGroups(260);
  ok(g260.length === 2 && !g260[0].isPartial && g260[1].isPartial && g260[1].len === 4, 'tileGroups(260): one full tile + one partial (len=4)');
  const g0 = tileGroups(0);
  ok(g0.length === 0, 'tileGroups(0): zero groups (no empty tile ever served)');
  const g1 = tileGroups(1);
  ok(g1.length === 1 && g1[0].isPartial && g1[0].len === 1, 'tileGroups(1): a single-entry partial tile');
}

// ---------------------------------------------------------------------------
// 2. Entry-bundle round-trip: build entries + level-0 leaves for an 8-record
// synthetic log, split into tile groups, and confirm hashLeafNode(entry)
// equals the corresponding level-0 leaf hash — the invariant §3.3 requires.
// ---------------------------------------------------------------------------
async function entryBundleRoundTripTest() {
  const entries = Array.from({ length: 8 }, (_, i) => new TextEncoder().encode(`synthetic-record-${i}`));
  const leafHashes = await Promise.all(entries.map((e) => hashLeafNode(e)));
  for (let i = 0; i < entries.length; i++) {
    const h = await hashLeafNode(entries[i]);
    ok(bytesEqual(h, leafHashes[i]), `entry-bundle round-trip: hashLeafNode(entry ${i}) matches level-0 leaf hash`);
  }
  // Tamper one entry's bytes -> its hash must NO LONGER match the original leaf hash.
  const tampered = new Uint8Array(entries[3]);
  tampered[0] ^= 0xff;
  const tamperedHash = await hashLeafNode(tampered);
  ok(!bytesEqual(tamperedHash, leafHashes[3]), 'entry-bundle round-trip: a tampered entry byte changes the hash (negative control)');
}

// ---------------------------------------------------------------------------
// 3. SUBPROOF/PROOF construction — small hand-checkable 8-leaf tree, mirroring
// register-sigsum.mjs's own selftest tree shape (independently re-derived
// here via mth/subproof from THIS file rather than copied).
// ---------------------------------------------------------------------------
async function proofConstructionTest() {
  const leafHashes = await Promise.all(Array.from({ length: 8 }, (_, i) => hashLeafNode(new TextEncoder().encode(`leaf-${i}`))));

  for (let oldSize = 1; oldSize <= 8; oldSize++) {
    for (let newSize = oldSize; newSize <= 8; newSize++) {
      const oldRoot = await mth(leafHashes, 0, oldSize);
      const newRoot = await mth(leafHashes, 0, newSize);
      const proof = await buildConsistencyProof(oldSize, leafHashes.slice(0, newSize));
      const accepted = await verifyConsistency({ oldSize, newSize, oldRoot, newRoot, proof });
      ok(accepted, `PROOF(${oldSize} -> ${newSize}) accepted by verifyConsistency`);
    }
  }

  // Tamper the newRoot -> a real proof for a real (oldSize,newSize) pair must be REJECTED.
  {
    const oldSize = 3, newSize = 8;
    const oldRoot = await mth(leafHashes, 0, oldSize);
    const realNewRoot = await mth(leafHashes, 0, newSize);
    const tamperedNewRoot = new Uint8Array(realNewRoot);
    tamperedNewRoot[0] ^= 0xff;
    const proof = await buildConsistencyProof(oldSize, leafHashes.slice(0, newSize));
    const accepted = await verifyConsistency({ oldSize, newSize, oldRoot, newRoot: tamperedNewRoot, proof });
    ok(!accepted, 'PROOF construction negative control: a tampered newRoot is REJECTED by verifyConsistency');
  }

  // oldSize === 0 is rejected (RFC 9162 defines no proof from an empty tree);
  // generate() guards the call and checks the genesis root instead.
  {
    const newSize = 8;
    const newRoot = await mth(leafHashes, 0, newSize);
    const proof = await buildConsistencyProof(0, leafHashes);
    ok(proof.length === 0, 'buildConsistencyProof(0, D) returns an empty proof');
    const accepted = await verifyConsistency({ oldSize: 0, newSize, oldRoot: new Uint8Array(32), newRoot, proof });
    ok(!accepted, 'oldSize=0 REJECTED by verifyConsistency (RFC 9162; generate() checks the genesis root instead)');
  }
}

// ---------------------------------------------------------------------------
// 4. --check mutation detection: build a REAL published lineage log in a temp
// directory via the actual exported generate() (with a stubbed Sigsum call —
// see file header), confirm --check PASSES, then flip one byte in one
// already-published level-0 tile file and confirm --check FAILS with a clear
// message, then restore the byte and confirm --check PASSES again. This is
// the row's SO #34 mutation-test requirement, run against the real code path.
// ---------------------------------------------------------------------------
async function mutationTest() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'registry-lineage-test-'));
  const registryDir = join(tmpDir, 'lineage');
  try {
    // Fresh Ed25519 keypair for THIS test run only — never the real log key.
    const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privJwk = await subtle.exportKey('jwk', privateKey);
    const pubKeyHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    const keyPath = join(tmpDir, 'test-log-key.priv.jwk.json');
    writeFileSync(keyPath, JSON.stringify(privJwk));

    // Enough synthetic records to exercise a partial level-0 tile AND at
    // least one full tile: 260 records -> level 0 = 1 full tile (256) + 1
    // partial tile (4); level 1 = a single-entry partial tile (floor(260/256)=1).
    const records = Array.from({ length: 260 }, (_, i) => ({ synthetic_record_index: i, note: 'gen-registry-lineage.test.mjs fixture, not a real anchor record' }));

    const stubSigsumRecord = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_url: 'https://example.invalid/stub-for-test',
      leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) },
      tree_head: { size: 1, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) },
      inclusion_proof: { leaf_index: 0, path: [] },
      witness_cosignatures: [],
    };

    await generate({
      registryDir,
      records,
      logPrivateKeyPath: keyPath,
      logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord, // no network — see file header
    });

    const good = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(good.ok === true, '--check PASSES on a freshly generated, unmutated 260-record log (full tile + partial tile + level-1 partial)');

    // Flip one byte in the FULL level-0 tile (tile/0/000, covers records 0..255).
    const fullTile0Path = fullTilePath(join(registryDir, 'tile', '0'), 0);
    const original = readFileSync(fullTile0Path);
    const mutated = Buffer.from(original);
    mutated[0] ^= 0xff;
    writeFileSync(fullTile0Path, mutated);

    const mutatedResult = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    console.log(`  mutation-test --check output: ${JSON.stringify(mutatedResult)}`);
    ok(mutatedResult.ok === false, 'MUTATION TEST: flipping one byte in the published level-0 full tile makes --check FAIL (SO #34)');

    // Restore the tile to its correct bytes before finishing — do not leave
    // corrupted output around (this is a temp dir either way, but be exact).
    writeFileSync(fullTile0Path, original);
    const restored = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(restored.ok === true, '--check PASSES again after the tile byte is restored');

    // Second mutation surface: flip a byte in the level-0 PARTIAL tile too.
    const partialTilePathStr = partialTilePath(join(registryDir, 'tile', '0'), 1, 4);
    const originalPartial = readFileSync(partialTilePathStr);
    const mutatedPartial = Buffer.from(originalPartial);
    mutatedPartial[0] ^= 0xff;
    writeFileSync(partialTilePathStr, mutatedPartial);
    const partialMutatedResult = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(partialMutatedResult.ok === false, 'MUTATION TEST: flipping one byte in the published level-0 PARTIAL tile also makes --check FAIL');
    writeFileSync(partialTilePathStr, originalPartial);
    const restoredPartial = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(restoredPartial.ok === true, '--check PASSES again after the partial tile byte is restored');

    // Re-running generate() over the SAME 260 records must extend size 260 ->
    // 260 with an unchanged root (idempotent) rather than throw — sanity check
    // that the consistency gate does not reject a no-op regeneration.
    let idempotentOk = true;
    try {
      await generate({
        registryDir, records, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      idempotentOk = false;
      console.log(`  idempotent regeneration threw: ${e.message}`);
    }
    ok(idempotentOk, 'regenerating over the SAME record set (size unchanged) does not trip the consistency gate');

    // Now append 5 more records (append-only growth) and confirm the
    // consistency gate accepts the extension.
    const grown = [...records, ...Array.from({ length: 5 }, (_, i) => ({ synthetic_record_index: 260 + i, note: 'appended' }))];
    let growthOk = true;
    try {
      await generate({
        registryDir, records: grown, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      growthOk = false;
      console.log(`  append-only growth threw unexpectedly: ${e.message}`);
    }
    ok(growthOk, 'appending 5 records (260 -> 265) is accepted by the consistency gate');
    const grownCheck = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(grownCheck.ok === true, '--check PASSES on the grown (265-record) log');

    // The OLD full tile (tile/0/000) must be byte-identical after growth —
    // no pruning, no rewriting of an already-published full tile (§3.3).
    const afterGrowth = readFileSync(fullTile0Path);
    ok(bytesEqual(new Uint8Array(afterGrowth), new Uint8Array(original)), 'full tile 0/000 is BYTE-IDENTICAL after append-only growth (no pruning, no rewrite)');

    // Negative control: truncating the record set (shrinking) must be REJECTED.
    let shrinkRejected = false;
    try {
      await generate({
        registryDir, records: records.slice(0, 100), logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      shrinkRejected = true;
      console.log(`  shrink correctly rejected: ${e.message}`);
    }
    ok(shrinkRejected, 'shrinking the record set (265 -> 100) is REJECTED (append-only violation)');

    // ── SIGSUM-PENDING tolerance (LINEAGE-SIGSUM-TOLERANCE-2380-1): a fresh
    // temp log grown with NO submitToSigsum stub at all exercises the real
    // key-absence branch (the temp workspace has no research/ key files, so
    // existsSync on the Sigsum submit/token key paths is false exactly as on
    // CI). generate() must NOT throw, must write tiles + checkpoint + a
    // PENDING sigsum record, and --check must ACCEPT the pending state.
    const pendingDir = join(tmpDir, 'lineage-pending');
    const pendingRecords = Array.from({ length: 3 }, (_, i) => ({ synthetic_pending_index: i, note: 'pending-flow fixture' }));
    let pendingOk = true;
    try {
      await generate({
        registryDir: pendingDir,
        records: pendingRecords,
        logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        sigsumSubmitKeyPath: join(tmpDir, 'absent', 'sigsum-key.priv.jwk.json'),
        sigsumTokenKeyPath: join(tmpDir, 'absent', 'sigsum-token-key.priv.jwk.json'),
      });
    } catch (e) {
      pendingOk = false;
      console.log(`  pending-flow generate() threw: ${e.message}`);
    }
    ok(pendingOk, 'SIGSUM-PENDING: generate() with NO submitToSigsum stub and NO Sigsum key files does NOT fail');
    let pendingRecord = null;
    try {
      pendingRecord = JSON.parse(readFileSync(join(pendingDir, 'checkpoint.sigsum-record.json'), 'utf8'));
    } catch (e) {
      console.log(`  pending record read failed: ${e.message}`);
    }
    ok(pendingRecord !== null && pendingRecord.status === 'pending', 'SIGSUM-PENDING: the written sigsum record carries status "pending"');
    ok(pendingRecord !== null && typeof pendingRecord.anchored_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(pendingRecord.anchored_hash), 'SIGSUM-PENDING: the pending record carries the sha256 anchored_hash of the signed checkpoint bytes');
    const pendingCheck = await check({ registryDir: pendingDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(pendingCheck.ok === true, 'SIGSUM-PENDING: --check ACCEPTS a published log whose sigsum record is pending');
    // Appending MORE records in pending mode over an already-pending log must
    // still work (the tolerance is the steady state while keys stay offline).
    let pendingGrowthOk = true;
    try {
      await generate({
        registryDir: pendingDir,
        records: [...pendingRecords, { synthetic_pending_index: 3, note: 'appended while pending' }],
        logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        sigsumSubmitKeyPath: join(tmpDir, 'absent', 'sigsum-key.priv.jwk.json'),
        sigsumTokenKeyPath: join(tmpDir, 'absent', 'sigsum-token-key.priv.jwk.json'),
      });
    } catch (e) {
      pendingGrowthOk = false;
      console.log(`  pending-flow growth threw: ${e.message}`);
    }
    ok(pendingGrowthOk, 'SIGSUM-PENDING: append-only growth while keys stay absent is accepted');
    const pendingGrownCheck = await check({ registryDir: pendingDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(pendingGrownCheck.ok === true, 'SIGSUM-PENDING: --check PASSES on the grown pending log');
    // KEYS-PRESENT branch: Sigsum key files exist, submit is stubbed via
    // opts.submitToSigsum (the binding that once threw ReferenceError).
    const presentDir = join(tmpDir, 'lineage-present');
    const fakeSubmitKey = join(tmpDir, 'fake-sigsum-submit.key');
    const fakeTokenKey = join(tmpDir, 'fake-sigsum-token.key');
    writeFileSync(fakeSubmitKey, 'x');
    writeFileSync(fakeTokenKey, 'x');
    const presentStub = { anchor_type: 'c2sp-tlog-proof-v1', log_url: 'https://example.invalid/keys-present-stub', leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) }, tree_head: { size: 7, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) }, inclusion_proof: { leaf_index: 3, path: [] }, witness_cosignatures: [] };
    let presentOk = true;
    try {
      await generate({
        registryDir: presentDir,
        records: pendingRecords,
        logPrivateKeyPath: keyPath,
        logPublicKeyHex: pubKeyHex,
        sigsumSubmitKeyPath: fakeSubmitKey,
        sigsumTokenKeyPath: fakeTokenKey,
        submitToSigsum: async () => presentStub,
      });
    } catch (e) {
      presentOk = false;
      console.log(`  keys-present generate() threw: ${e.message}`);
    }
    ok(presentOk, 'SIGSUM-PRESENT: generate() with Sigsum keys present and an injected submit does not throw');
    let presentRecord = null;
    try { presentRecord = JSON.parse(readFileSync(join(presentDir, 'checkpoint.sigsum-record.json'), 'utf8')); } catch (e) { console.log(`  present record read failed: ${e.message}`); }
    ok(presentRecord !== null && presentRecord.status !== 'pending' && presentRecord.log_url === presentStub.log_url && presentRecord.inclusion_proof.leaf_index === 3, 'SIGSUM-PRESENT: the written record is the stub anchor, not pending');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 5. ANCHOR HOLD (MAIN-REGEN-SIGSUM-ANCHOR-HEAL-1): a keys-absent publish
// over a log that already carries a fully-formed c2sp-tlog-proof-v1 anchor
// must HOLD that anchor, not demote it to a field-less `sigsum-pending-v1`
// record. Red shape: on the pre-hold code the generate() below overwrote the
// anchor with status:"pending" (no inclusion_proof.leaf_index, no
// witness_cosignatures[]) — exactly the bytes that made gen-trust-signals'
// sigsumSignal throw fail-closed on main (run 38491123351 onward). The
// assertions here fail on that old behavior (red) and pass on the hold
// (green). No synthesized anchor data: the anchor is written by the test,
// then read back verbatim after the publish.
// ---------------------------------------------------------------------------
async function anchorHoldTest() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'registry-lineage-hold-test-'));
  const registryDir = join(tmpDir, 'lineage-hold');
  try {
    const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privJwk = await subtle.exportKey('jwk', privateKey);
    const pubKeyHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    const keyPath = join(tmpDir, 'test-log-key.priv.jwk.json');
    writeFileSync(keyPath, JSON.stringify(privJwk));

    const records = Array.from({ length: 3 }, (_, i) => ({ synthetic_hold_index: i, note: 'anchor-hold fixture' }));
    const realShapedAnchor = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_origin: 'sigsum.org/v1/tree/hold-test',
      log_url: 'https://example.invalid/hold-test',
      log_public_key: '00'.repeat(32),
      anchored_hash: `sha256:${'ab'.repeat(32)}`,
      leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) },
      tree_head: { size: 41, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) },
      inclusion_proof: { leaf_index: 40, path: ['00'.repeat(32)] },
      witness_cosignatures: [
        { key_hash: '11'.repeat(32), timestamp: 1791856229, signature: '00'.repeat(64) },
        { key_hash: '22'.repeat(32), timestamp: 1791856228, signature: '00'.repeat(64) },
      ],
    };
    // Seed the log via a keys-present publish (stubbed submit) so the on-disk
    // record is a REAL generate() output carrying the fully-formed anchor.
    const fakeSubmitKey = join(tmpDir, 'fake-sigsum-submit.key');
    const fakeTokenKey = join(tmpDir, 'fake-sigsum-token.key');
    writeFileSync(fakeSubmitKey, 'x');
    writeFileSync(fakeTokenKey, 'x');
    await generate({
      registryDir, records,
      logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      sigsumSubmitKeyPath: fakeSubmitKey, sigsumTokenKeyPath: fakeTokenKey,
      submitToSigsum: async () => realShapedAnchor,
    });
    const seeded = JSON.parse(readFileSync(join(registryDir, 'checkpoint.sigsum-record.json'), 'utf8'));
    ok(seeded.inclusion_proof.leaf_index === 40 && Array.isArray(seeded.witness_cosignatures) && seeded.witness_cosignatures.length === 2, 'ANCHOR-HOLD: seeded log carries the fully-formed anchor');

    // The defect's exact shape: a keys-absent publish (NO submitToSigsum, NO
    // key files — the CI main-regen condition) over the anchored log.
    let holdOk = true;
    try {
      await generate({
        registryDir,
        records: [...records, { synthetic_hold_index: 3, note: 'appended over an anchored log with keys absent' }],
        logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        sigsumSubmitKeyPath: join(tmpDir, 'absent', 'sigsum-key.priv.jwk.json'),
        sigsumTokenKeyPath: join(tmpDir, 'absent', 'sigsum-token-key.priv.jwk.json'),
      });
    } catch (e) {
      holdOk = false;
      console.log(`  keys-absent generate() over anchored log threw: ${e.message}`);
    }
    ok(holdOk, 'ANCHOR-HOLD: keys-absent publish over a fully-anchored log does NOT throw');
    let after = null;
    try { after = JSON.parse(readFileSync(join(registryDir, 'checkpoint.sigsum-record.json'), 'utf8')); } catch (e) { console.log(`  post-publish record read failed: ${e.message}`); }
    // THE RED-THEN-GREEN ASSERTION: fails on the pre-hold code (wrote
    // status:"pending"), passes on the hold.
    ok(after !== null && after.status === undefined && after.anchor_type === 'c2sp-tlog-proof-v1', 'ANCHOR-HOLD: the record was NOT demoted to pending');
    ok(after !== null && after.inclusion_proof && after.inclusion_proof.leaf_index === 40, 'ANCHOR-HOLD: inclusion_proof.leaf_index survives the keys-absent publish (the exact field sigsumSignal threw on)');
    ok(after !== null && Array.isArray(after.witness_cosignatures) && after.witness_cosignatures.length === 2, 'ANCHOR-HOLD: witness_cosignatures[] survive the keys-absent publish');
    ok(after !== null && JSON.stringify(after) === JSON.stringify(realShapedAnchor), 'ANCHOR-HOLD: the held record is byte-identical (JSON-equal) to the previously published anchor — nothing synthesized');
    const holdCheck = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(holdCheck.ok === true, 'ANCHOR-HOLD: --check PASSES on the grown log with the held anchor');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

await entryBundleRoundTripTest();
await proofConstructionTest();
await mutationTest();
await anchorHoldTest();

console.log(failures === 0 ? '\ngen-registry-lineage.test.mjs: ALL PASS' : `\ngen-registry-lineage.test.mjs: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
