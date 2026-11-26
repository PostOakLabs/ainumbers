// zk-trust-inventory.selftest.mjs -- proven-to-reject selftest for zk-trust-inventory.mjs.
// Run: node scripts/zk-trust-inventory.selftest.mjs   (exit 0 = pass)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeInventory, tally, trustCountKeys } from './zk-trust-inventory.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'zk-trust-inventory.mjs');

const sealed = (id, imageId, extra = {}) => ({
  tool_id: id, status: 'live',
  compute_images: [{ system: 'sha256-source', image_id: 'sha256:aa' }, { system: 'risc0', image_id: imageId }],
  compute_proof: { type: 'ZkVmReceipt', system: 'risc0', receiptFormat: 'groth16-bn254', imageId, seal: '0xdead', journal: { output: { ok: true } } },
  ...extra,
});
const IMG1 = 'sha256:' + '1'.repeat(64);
const IMG2 = 'sha256:' + '2'.repeat(64);

const fixture = {
  nodes: [
    sealed('art-1-a', IMG1),
    sealed('art-2-b', IMG1),
    sealed('art-3-c', IMG2),
    sealed('art-4-d', IMG1),
    { tool_id: 'art-5-e', status: 'live', compute_proof_ready: 'deferred', deferred_reason: 'heavy compute' },
    { tool_id: 'art-6-f', status: 'draft' },
  ],
  chainVerdicts: [{ verdict: 'L1-pass', steps: ['art-2-b', 'art-5-e'] }, { verdict: 'L1-fail', steps: ['art-3-c'] }],
  fvRecords: {
    'art-3-c': { evidence_vector: [{ k: 1 }], kernel_digest_at_authoring: 'sha256:cur' },
    'art-4-d': { evidence_vector: [{ k: 1 }], kernel_digest_at_authoring: 'sha256:old' },
  },
  currentDigests: { 'art-3-c': 'sha256:cur', 'art-4-d': 'sha256:new' },
  attestedIds: ['art-1-a', 'art-6-f'],
};

const inv = computeInventory(fixture);
const stageOf = Object.fromEntries(inv.nodes.map((n) => [n.tool_id, n.stage]));
assert.equal(inv.live_nodes, 5, 'draft node excluded');
assert.equal(stageOf['art-1-a'], 'S1');
assert.equal(stageOf['art-2-b'], 'S3', 'L1-pass chain member');
assert.equal(stageOf['art-3-c'], 'S2', 'fresh FV evidence, chain verdict fail');
assert.equal(stageOf['art-4-d'], 'S1', 'stale FV digest does not count');
assert.equal(stageOf['art-5-e'], 'S0', 'deferred node is unsealed even inside an L1-pass chain');
assert.deepEqual(inv.stage_counts, { S0: 1, S1: 2, S2: 1, S3: 1 });
assert.deepEqual(inv.image_id_group_counts, [3, 1]);
assert.deepEqual(inv.unsealed, ['art-5-e']);
assert.deepEqual(inv.caller_attested, ['art-1-a'], 'non-live attested id dropped');
assert.deepEqual(inv.nodes[0].anchor_legs, ['groth16-bn254-seal', 'risc0', 'sha256-source']);
assert.equal(trustCountKeys(inv)['trust.sealed'], 4);
assert.equal(JSON.stringify(computeInventory(fixture)), JSON.stringify(inv), 'deterministic');

assert.throws(() => tally(['S1', 'S9']), /unknown trust stage/);
assert.throws(() => computeInventory({ nodes: [{ ...sealed('art-7-g', IMG1), declared_stage: 'S7' }] }), /unknown trust stage/);

// CLI: good fixture exits 0, unknown stage exits nonzero.
const dir = mkdtempSync(resolve(tmpdir(), 'zkti-'));
const good = resolve(dir, 'good.json');
const bad = resolve(dir, 'bad.json');
writeFileSync(good, JSON.stringify(fixture));
writeFileSync(bad, JSON.stringify({ nodes: [{ ...sealed('art-7-g', IMG1), declared_stage: 'S7' }] }));
assert.equal(spawnSync(process.execPath, [SCRIPT, '--fixture', good], { encoding: 'utf8' }).status, 0);
const r = spawnSync(process.execPath, [SCRIPT, '--fixture', bad], { encoding: 'utf8' });
assert.notEqual(r.status, 0, 'unknown stage must exit nonzero');
assert.match(r.stderr, /unknown trust stage/);

console.log('zk-trust-inventory selftest: PASS');
