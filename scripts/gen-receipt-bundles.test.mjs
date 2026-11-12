// gen-receipt-bundles.test.mjs — RECEIPT-BUNDLE-PUBLISH-1 selftest.
//
// 1. The wrapper reproduces §5 fixtures a, b and e BYTE-FOR-BYTE from their published sources: the wrapper
//    adds nothing to what receipt-bundle-build.mjs produces, and its §3.4 subject is the builder's.
//    (c and d are deliberate mutations of a, not builds from a source, so they are out of scope here.)
// 2. A stale receipt is refused: a node whose journal.kernel_digest is not the fresh recompute never
//    becomes a bundle.
// 3. Published bundles carry §2 members only (no build_note) and an anchor subject of kind
//    registry-checkpoint.
//
// Run: node --test scripts/gen-receipt-bundles.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { renderBundle, bundleForNode, lineageAnchor, shardPath, REGISTRY_LINEAGE_SUBJECT } from './gen-receipt-bundles.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = 'chaingraph/standard/fixtures/receipt-bundle';
const SECTION2_TOP = new Set(['bundle_version', 'receipt', 'journal_contract', 'provenance', 'anchor', 'trust_policy']);

// The registry-lineage log has grown since the fixtures were built (checkpoint size 33 in the fixtures, larger
// at origin/main), so the anchor source a fixture was built from is no longer the file at that path. Each
// fixture carries that anchor verbatim (§4), so the test restores those bytes into a scratch root as the
// anchor source; the receipt and the trust policy are read from the live repo, unchanged.
function fixtureRoot(fx) {
  const root = mkdtempSync(join(tmpdir(), 'gen-receipt-bundles-fx-'));
  const copy = (rel) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); cpSync(join(REPO, rel), join(root, rel)); };
  copy(fx.provenance.receipt_source);
  copy('chaingraph/policies/sigsum-generic-2025-1.tlog-policy');
  if (fx.anchor) {
    mkdirSync(join(root, 'registry/lineage'), { recursive: true });
    writeFileSync(join(root, fx.provenance.anchor_source), JSON.stringify(fx.anchor.record));
    writeFileSync(join(root, fx.provenance.checkpoint_source), fx.anchor.checkpoint_text);
  }
  return root;
}

for (const name of ['a-single-node-both-green', 'b-proof-valid-log-absent', 'e-composed-receipt']) {
  test(`fixture ${name} reproduces byte-for-byte through the wrapper`, async () => {
    const want = readFileSync(join(REPO, FIX, `${name}.bundle.json`), 'utf8');
    const fx = JSON.parse(want);
    const src = fx.provenance.receipt_source;
    const root = fixtureRoot(fx);
    try {
      const got = await renderBundle({
        receipt: JSON.parse(readFileSync(join(root, src), 'utf8')),
        receiptSourcePath: src,
        anchor: fx.anchor ? lineageAnchor(root) : null,
        note: fx.build_note,
        repoRoot: root,
      });
      assert.equal(got, want);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

// A throwaway repo root holding one shard plus the anchor and policy files the builder reads.
function scratchRepo(receipt) {
  const root = mkdtempSync(join(tmpdir(), 'gen-receipt-bundles-'));
  for (const rel of [
    'registry/lineage/checkpoint.sigsum-record.json',
    'registry/lineage/checkpoint',
    'chaingraph/policies/sigsum-generic-2025-1.tlog-policy',
  ]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    cpSync(join(REPO, rel), join(root, rel));
  }
  mkdirSync(join(root, 'chaingraph/graph/nodes'), { recursive: true });
  writeFileSync(join(root, shardPath('art-test')), JSON.stringify({ tool_id: 'art-test', compute_proof: receipt }, null, 2) + '\n');
  return root;
}

const corpusReceipt = () => JSON.parse(readFileSync(join(REPO, 'chaingraph/kernels/fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json'), 'utf8'));

test('a stale receipt is refused, never bundled', async () => {
  const receipt = corpusReceipt();
  const root = scratchRepo(receipt);
  try {
    await assert.rejects(
      bundleForNode({ toolId: 'art-test', freshDigest: 'sha256:' + '0'.repeat(64), repoRoot: root }),
      /STALE receipt refused/
    );
    await assert.rejects(bundleForNode({ toolId: 'art-test', freshDigest: undefined, repoRoot: root }), /STALE receipt refused/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a fresh receipt bundles with §2 members only and a registry-checkpoint subject', async () => {
  const receipt = corpusReceipt();
  const root = scratchRepo(receipt);
  try {
    const b = JSON.parse(await bundleForNode({ toolId: 'art-test', freshDigest: receipt.journal.kernel_digest, repoRoot: root }));
    for (const k of Object.keys(b)) assert.ok(SECTION2_TOP.has(k), `field not in RECEIPT-BUNDLE §2: ${k}`);
    assert.deepEqual(b.anchor.subject, REGISTRY_LINEAGE_SUBJECT);
    assert.equal(b.anchor.subject.kind, 'registry-checkpoint');
    assert.equal(b.provenance.receipt_source, shardPath('art-test'));
    assert.equal(b.receipt.seal, receipt.seal);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
