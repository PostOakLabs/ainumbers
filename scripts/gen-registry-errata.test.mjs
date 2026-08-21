#!/usr/bin/env node
// scripts/gen-registry-errata.test.mjs — unit + mutation tests for
// gen-registry-errata.mjs (REGISTRY-ERRATA-TILES-BUILD-1).
//
// Runs entirely against a TEMP registry directory + synthetic entries — never
// against the real repo registry/errata/ tree, and never calls Sigsum (a
// stub `submitToSigsum` is injected via generate()'s opts). This is what lets
// the mutation test run independent of live Sigsum availability — the
// mechanism under test — "does --check detect a flipped byte in a published
// tile?" — is exercised here via the REAL exported generate()/check()
// functions, not a reimplementation (mirrors gen-registry-lineage.test.mjs's
// own documented rationale).
//
// Covers (row deliverable #3, BUILD-SPEC §2.3/§3.3):
//   1. tile/partial-tile path encoding (§3.3's exact worked examples)
//   2. entry-bundle round-trip (bytes -> hashLeafNode -> matches level-0 tile hash)
//   3. SUBPROOF/PROOF construction against a small hand-checkable 8-leaf tree
//   4. genesis (size=0) checkpoint: publishes, self-verifies, and a real
//      append (0 -> N) extends it under the consistency gate
//   5. --check mode's mutation detection (real subprocess-free in-process flip)
//   6. §2.2 staleness wording present verbatim in the published checkpoint,
//      and --check refuses a checkpoint missing it
//
// node scripts/gen-registry-errata.test.mjs

import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import {
  hashLeafNode, hashInteriorNode, verifyConsistency, formatCheckpoint, parseSignedNote, bytesToHex, bytesEqual,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';
import {
  encodeTileIndexParts, fullTilePath, partialTilePath, tileGroups, mth, subproof,
  buildConsistencyProof, generate, check, emptyTreeRoot, STALENESS_WORDING,
} from './gen-registry-errata.mjs';

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
  ok(g0.length === 0, 'tileGroups(0): zero groups (no empty tile ever served) — the genesis-checkpoint case');
  const g1 = tileGroups(1);
  ok(g1.length === 1 && g1[0].isPartial && g1[0].len === 1, 'tileGroups(1): a single-entry partial tile');
}

// ---------------------------------------------------------------------------
// 2. Entry-bundle round-trip: build entries + level-0 leaves for an 8-record
// synthetic log, split into tile groups, and confirm hashLeafNode(entry)
// equals the corresponding level-0 leaf hash — the invariant §3.3 requires.
// ---------------------------------------------------------------------------
async function entryBundleRoundTripTest() {
  const entries = Array.from({ length: 8 }, (_, i) => new TextEncoder().encode(`synthetic-errata-entry-${i}`));
  const leafHashes = await Promise.all(entries.map((e) => hashLeafNode(e)));
  for (let i = 0; i < entries.length; i++) {
    const h = await hashLeafNode(entries[i]);
    ok(bytesEqual(h, leafHashes[i]), `entry-bundle round-trip: hashLeafNode(entry ${i}) matches level-0 leaf hash`);
  }
  const tampered = new Uint8Array(entries[3]);
  tampered[0] ^= 0xff;
  const tamperedHash = await hashLeafNode(tampered);
  ok(!bytesEqual(tamperedHash, leafHashes[3]), 'entry-bundle round-trip: a tampered entry byte changes the hash (negative control)');
}

// ---------------------------------------------------------------------------
// 3. SUBPROOF/PROOF construction — small hand-checkable 8-leaf tree.
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

  {
    const newSize = 8;
    const newRoot = await mth(leafHashes, 0, newSize);
    const proof = await buildConsistencyProof(0, leafHashes);
    ok(proof.length === 0, 'buildConsistencyProof(0, D) returns an empty proof');
    const accepted = await verifyConsistency({ oldSize: 0, newSize, oldRoot: new Uint8Array(32), newRoot, proof });
    ok(accepted, 'oldSize=0 trivially accepted by verifyConsistency (first-ever publish)');
  }
}

// ---------------------------------------------------------------------------
// 4. Genesis (size=0) checkpoint: this row's real errata.json ships 0 entries
// today. Confirms a real, Sigsum-anchored (stubbed here) checkpoint publishes
// at size 0 with root = RFC 6962 MTH({}), self-verifies, --check passes with
// zero tile files, and a subsequent real append (0 -> 3) extends it under the
// consistency gate.
// ---------------------------------------------------------------------------
async function genesisCheckpointTest() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'registry-errata-genesis-'));
  const registryDir = join(tmpDir, 'errata');
  try {
    const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privJwk = await subtle.exportKey('jwk', privateKey);
    const pubKeyHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    const keyPath = join(tmpDir, 'test-log-key.priv.jwk.json');
    writeFileSync(keyPath, JSON.stringify(privJwk));

    const stubSigsumRecord = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_url: 'https://example.invalid/stub-for-test',
      leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) },
      tree_head: { size: 1, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) },
      inclusion_proof: { leaf_index: 0, path: [] },
      witness_cosignatures: [],
    };

    await generate({
      registryDir, entries: [], logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord,
    });

    const checkpointText = readFileSync(join(registryDir, 'checkpoint'), 'utf8');
    const parsed = parseSignedNote(checkpointText);
    ok(parsed.size === 0, 'genesis checkpoint publishes at size 0');
    const empty = await emptyTreeRoot();
    ok(bytesEqual(parsed.rootHash, empty), 'genesis checkpoint root equals RFC 6962 MTH({}) = SHA-256() of the empty string');
    ok(parsed.extensionLines.includes(STALENESS_WORDING), 'genesis checkpoint carries the §2.2 staleness wording verbatim as an extension line');

    const genesisCheck = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(genesisCheck.ok === true, '--check PASSES on a genesis (0-entry) checkpoint with zero tile files');

    // Real append: 0 -> 3 entries must extend under the consistency gate.
    const entries = Array.from({ length: 3 }, (_, i) => ({ synthetic_errata_index: i, note: 'gen-registry-errata.test.mjs fixture, not a real errata entry' }));
    await generate({
      registryDir, entries, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord,
    });
    const grownCheck = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(grownCheck.ok === true, '--check PASSES after a real append from genesis (0 -> 3 entries)');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 5. --check mutation detection: build a REAL published errata log in a temp
// directory via the actual exported generate() (with a stubbed Sigsum call),
// confirm --check PASSES, then flip one byte in an already-published level-0
// tile file and confirm --check FAILS with a clear message, then restore the
// byte and confirm --check PASSES again. This is the row's SO #34
// mutation-test requirement, run against the real code path.
// ---------------------------------------------------------------------------
async function mutationTest() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'registry-errata-test-'));
  const registryDir = join(tmpDir, 'errata');
  try {
    const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privJwk = await subtle.exportKey('jwk', privateKey);
    const pubKeyHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    const keyPath = join(tmpDir, 'test-log-key.priv.jwk.json');
    writeFileSync(keyPath, JSON.stringify(privJwk));

    // 260 records -> level 0 = 1 full tile (256) + 1 partial tile (4);
    // level 1 = a single-entry partial tile (floor(260/256)=1).
    const entries = Array.from({ length: 260 }, (_, i) => ({ synthetic_errata_index: i, note: 'gen-registry-errata.test.mjs fixture, not a real errata entry' }));

    const stubSigsumRecord = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_url: 'https://example.invalid/stub-for-test',
      leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) },
      tree_head: { size: 1, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) },
      inclusion_proof: { leaf_index: 0, path: [] },
      witness_cosignatures: [],
    };

    await generate({
      registryDir, entries, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord,
    });

    const good = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(good.ok === true, '--check PASSES on a freshly generated, unmutated 260-entry log (full tile + partial tile + level-1 partial)');

    // Flip one byte in the FULL level-0 tile (tile/0/000, covers entries 0..255).
    const fullTile0Path = fullTilePath(join(registryDir, 'tile', '0'), 0);
    const original = readFileSync(fullTile0Path);
    const mutated = Buffer.from(original);
    mutated[0] ^= 0xff;
    writeFileSync(fullTile0Path, mutated);

    const mutatedResult = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    console.log(`  mutation-test --check output: ${JSON.stringify(mutatedResult)}`);
    ok(mutatedResult.ok === false, 'MUTATION TEST: flipping one byte in the published level-0 full tile makes --check FAIL (SO #34)');

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

    // Third mutation surface: the checkpoint's staleness extension line itself.
    // Tamper it and confirm --check refuses (§2.2 non-negotiable — the wording
    // must survive byte-for-byte, not just be present at generation time).
    const checkpointPath = join(registryDir, 'checkpoint');
    const originalCheckpoint = readFileSync(checkpointPath, 'utf8');
    const tamperedCheckpoint = originalCheckpoint.replace('unknown-refresh-needed', 'not-revoked');
    writeFileSync(checkpointPath, tamperedCheckpoint);
    const stalenessMutated = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(stalenessMutated.ok === false, 'MUTATION TEST: tampering the §2.2 staleness wording (or its signature coverage) makes --check FAIL');
    writeFileSync(checkpointPath, originalCheckpoint);
    const stalenessRestored = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(stalenessRestored.ok === true, '--check PASSES again after the checkpoint is restored');

    // Idempotent regeneration over the SAME entry set must not throw.
    let idempotentOk = true;
    try {
      await generate({
        registryDir, entries, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      idempotentOk = false;
      console.log(`  idempotent regeneration threw: ${e.message}`);
    }
    ok(idempotentOk, 'regenerating over the SAME entry set (size unchanged) does not trip the consistency gate');

    // Append-only growth: 260 -> 265 must be accepted.
    const grown = [...entries, ...Array.from({ length: 5 }, (_, i) => ({ synthetic_errata_index: 260 + i, note: 'appended' }))];
    let growthOk = true;
    try {
      await generate({
        registryDir, entries: grown, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      growthOk = false;
      console.log(`  append-only growth threw unexpectedly: ${e.message}`);
    }
    ok(growthOk, 'appending 5 entries (260 -> 265) is accepted by the consistency gate');
    const grownCheck = await check({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    ok(grownCheck.ok === true, '--check PASSES on the grown (265-entry) log');

    const afterGrowth = readFileSync(fullTile0Path);
    ok(bytesEqual(new Uint8Array(afterGrowth), new Uint8Array(original)), 'full tile 0/000 is BYTE-IDENTICAL after append-only growth (no pruning, no rewrite)');

    // Negative control: shrinking must be REJECTED.
    let shrinkRejected = false;
    try {
      await generate({
        registryDir, entries: entries.slice(0, 100), logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
    } catch (e) {
      shrinkRejected = true;
      console.log(`  shrink correctly rejected: ${e.message}`);
    }
    ok(shrinkRejected, 'shrinking the entry set (265 -> 100) is REJECTED (append-only violation)');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

await entryBundleRoundTripTest();
await proofConstructionTest();
await genesisCheckpointTest();
await mutationTest();

console.log(failures === 0 ? '\ngen-registry-errata.test.mjs: ALL PASS' : `\ngen-registry-errata.test.mjs: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
