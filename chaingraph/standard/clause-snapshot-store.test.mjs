import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRegistryUnion, addShard, assembleSorted, shardDirFor, shardFileName, shardText } from './clause-snapshot-store.mjs';

const D = (c) => 'sha256:' + c.repeat(64);
const entry = (c, extra = {}) => ({ digest: D(c), excerpt_bytes: 1, clause_path: 'p', source_url: 'u', retrieved_at: '2026-11-03', scheme: null, id: null, registered_by: 't', registered_at: '2026-11-03', ...extra });
const sandbox = (legacy) => {
  const dir = mkdtempSync(join(tmpdir(), 'csr-'));
  const p = join(dir, 'clause-snapshot-registry.json');
  if (legacy) writeFileSync(p, JSON.stringify(legacy, null, 2) + '\n');
  return p;
};

test('legacy-only, shard-only and mixed all assemble', () => {
  assert.equal(loadRegistryUnion(sandbox([entry('a')])).length, 1);
  const p = sandbox(null);
  addShard(p, entry('b'));
  assert.equal(loadRegistryUnion(p).length, 1);
  const q = sandbox([entry('a')]);
  addShard(q, entry('b'));
  assert.deepEqual(assembleSorted(q).map((e) => e.digest), [D('a'), D('b')]);
});

test('same digest in both with equal bytes dedupes; different bytes refuses', () => {
  const p = sandbox([entry('a')]);
  mkdirSync(shardDirFor(p), { recursive: true });
  writeFileSync(join(shardDirFor(p), shardFileName(D('a'))), shardText(entry('a')));
  assert.equal(loadRegistryUnion(p).length, 1);
  writeFileSync(join(shardDirFor(p), shardFileName(D('a'))), shardText(entry('a', { clause_path: 'other' })));
  assert.throws(() => loadRegistryUnion(p), /conflict/);
});

test('addShard writes one new file, is idempotent, and leaves the legacy file untouched', () => {
  const p = sandbox([entry('a')]);
  const before = readFileSync(p, 'utf8');
  assert.equal(addShard(p, entry('c')).added, true);
  assert.equal(addShard(p, entry('c')).added, false);
  assert.equal(addShard(p, entry('a')).added, false);
  assert.deepEqual(readdirSync(shardDirFor(p)), [shardFileName(D('c'))]);
  assert.equal(readFileSync(p, 'utf8'), before);
});
