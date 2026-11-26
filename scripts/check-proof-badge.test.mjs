// check-proof-badge.test.mjs — PENDING-ASSEMBLE skip (MUSE52-PROOF-BADGE-PENDING-ASSEMBLE-1).
// Builds synthetic trees and runs the gate against them through the PROOF_BADGE_REPO seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATE = resolve(dirname(fileURLToPath(import.meta.url)), 'check-proof-badge.mjs');
const BADGE = '<span class="badge badge-green">Proof verified</span>';

function tree({ nodes = [], shards = [], pages = [] }) {
  const root = mkdtempSync(join(tmpdir(), 'proof-badge-'));
  mkdirSync(join(root, 'chaingraph/graph/nodes'), { recursive: true });
  writeFileSync(join(root, 'chaingraph/chaingraph.json'), JSON.stringify({ nodes }));
  for (const s of shards) writeFileSync(join(root, `chaingraph/graph/nodes/${s}.json`), '{}');
  for (const p of pages) writeFileSync(join(root, `chaingraph/${p}.html`), `<html>${BADGE}</html>`);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [GATE], { env: { ...process.env, PROOF_BADGE_REPO: root }, encoding: 'utf8' });
}

test('badged page, node on disk as shard but not in monolith: skipped (exit 0)', () => {
  const root = tree({ shards: ['art-9001'], pages: ['art-9001'] });
  try {
    const r = run(root);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /PENDING-ASSEMBLE.*art-9001\.html/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('badged page with neither monolith node nor shard: still unmapped (exit 1)', () => {
  const root = tree({ pages: ['art-9002'] });
  try {
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no chaingraph\.json node/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('live node whose state cannot support the badge still fails even with a shard on disk', () => {
  const root = tree({ nodes: [{ tool_id: 'art-9003' }], shards: ['art-9003'], pages: ['art-9003'] });
  try {
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /art-9003\.html/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
