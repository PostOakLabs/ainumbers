// _hub-categories.selftest.mjs — controls for resolveNodeHubs() (HUB-AUTOSWEEP-SSOT-1).
//
// Proves, on synthetic file pairs and on the real tree:
//   1. a per-node "hubs" key wins over the cluster's "hub" default
//   2. a cluster "hub" default applies when the per-node file carries no "hubs" key
//   3. neither set -> { hubs: [], source: 'none' }
//   4. "hubs": [] without "hub_exempt" throws
//   5. "hubs": [] + "hub_exempt" -> source 'exempt' with the reason
//   6. a slug failing ^[a-z0-9]+(-[a-z0-9]+)*$ throws (per-node and cluster forms)
//   7. loadHubCategories() is unchanged: its output never carries the new keys, and on
//      the real tree every per-node file still lands in exactly one art_ids array
//   8. duplicate slugs dedupe, order preserved
//   9. resolveNodeHubs() parses the REAL tree without throwing (the seed data stays valid)
//
// Usage: node scripts/_hub-categories.selftest.mjs   (exit 0 = all cases pass)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHubCategories, resolveNodeHubs, HUB_SLUG_RE } from './_hub-categories.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

/** Build a throwaway file pair: cluster meta + per-node membership files. */
function fixtureTree(meta, files) {
  const root = mkdtempSync(join(tmpdir(), 'hubcat-'));
  mkdirSync(join(root, 'chaingraph', 'hub-categories'), { recursive: true });
  writeFileSync(join(root, 'chaingraph', 'hub-categories.json'), JSON.stringify(meta, null, 2) + '\n');
  for (const [id, doc] of Object.entries(files)) {
    writeFileSync(join(root, 'chaingraph', 'hub-categories', `${id}.json`), JSON.stringify(doc, null, 2) + '\n');
  }
  return root;
}

const META = {
  'Cluster One': { order: 1, blurb: 'b1' },
  'Cluster Two': { order: 2, blurb: 'b2', hub: 'cluster-two-topic' },
};

test('per-node hubs key wins over the cluster default', () => {
  const root = fixtureTree(META, {
    'art-1-node-a': { category: 'Cluster Two', hubs: ['ethereum', 'solana'] },
  });
  try {
    const resolved = resolveNodeHubs(root);
    assert.deepEqual(resolved.get('art-1-node-a'), { hubs: ['ethereum', 'solana'], source: 'node' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('cluster hub default applies when the per-node file has no hubs key', () => {
  const root = fixtureTree(META, {
    'art-1-node-a': { category: 'Cluster Two' }, // cluster carries hub
    'art-2-node-b': { category: 'Cluster One' }, // cluster does not
  });
  try {
    const resolved = resolveNodeHubs(root);
    assert.deepEqual(resolved.get('art-1-node-a'), { hubs: ['cluster-two-topic'], source: 'cluster' });
    assert.deepEqual(resolved.get('art-2-node-b'), { hubs: [], source: 'none' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('"hubs": [] without hub_exempt throws', () => {
  const root = fixtureTree(META, { 'art-1-node-a': { category: 'Cluster One', hubs: [] } });
  try {
    assert.throws(() => resolveNodeHubs(root), /hub_exempt/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('"hubs": [] + hub_exempt resolves as the explicit opt-out with its reason', () => {
  const root = fixtureTree(META, {
    'art-1-node-a': { category: 'Cluster Two', hubs: [], hub_exempt: 'internal demonstrator, mcp.html url' },
  });
  try {
    const resolved = resolveNodeHubs(root);
    assert.deepEqual(resolved.get('art-1-node-a'), {
      hubs: [], source: 'exempt', exempt_reason: 'internal demonstrator, mcp.html url',
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a slug failing the guides/<slug>-hub.html rule throws (per-node form)', () => {
  const root = fixtureTree(META, { 'art-1-node-a': { category: 'Cluster One', hubs: ['Ethereum'] } });
  try {
    assert.throws(() => resolveNodeHubs(root), /not a valid hub slug/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a slug failing the rule throws (cluster default form)', () => {
  const meta = { 'Bad Cluster': { order: 3, blurb: 'b', hub: 'double--hyphen' } };
  const root = fixtureTree(meta, { 'art-1-node-a': { category: 'Bad Cluster' } });
  try {
    assert.throws(() => resolveNodeHubs(root), /not a valid slug/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('duplicate slugs dedupe with order preserved', () => {
  const root = fixtureTree(META, {
    'art-1-node-a': { category: 'Cluster One', hubs: ['solana', 'ethereum', 'solana'] },
  });
  try {
    assert.deepEqual(resolveNodeHubs(root).get('art-1-node-a').hubs, ['solana', 'ethereum']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unknown category throws (same rule as the loader)', () => {
  const root = fixtureTree(META, { 'art-1-node-a': { category: 'No Such Cluster' } });
  try {
    assert.throws(() => resolveNodeHubs(root), /is not a key/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('HUB_SLUG_RE accepts real guide slugs and rejects path/url shapes', () => {
  for (const ok of ['ethereum', 'sr262-model-risk-monitoring', 'dora-operational-resilience', 'a0']) {
    assert.match(ok, HUB_SLUG_RE);
  }
  for (const bad of ['Ethereum', '-lead', 'trail-', 'dou--ble', '', 'a/b', '../x', 'a b', 'x.html']) {
    assert.doesNotMatch(bad, HUB_SLUG_RE);
  }
});

test('loadHubCategories() output carries no hub keys on a hubs-bearing tree (reader unchanged)', () => {
  const root = fixtureTree(META, {
    'art-1-node-a': { category: 'Cluster Two', hubs: ['ethereum'] },
    'art-2-node-b': { category: 'Cluster Two' },
  });
  try {
    const loaded = loadHubCategories(root);
    assert.deepEqual(loaded, {
      'Cluster One': { order: 1, blurb: 'b1', art_ids: [] },
      'Cluster Two': { order: 2, blurb: 'b2', hub: 'cluster-two-topic', art_ids: ['art-1-node-a', 'art-2-node-b'] },
    });
    // The legacy shape must stay exactly { order, blurb, art_ids } (+ any pre-existing
    // cluster keys like "hub") — a hubs key on a member file must never leak in.
    for (const entry of Object.values(loaded)) {
      assert.deepEqual(Object.keys(entry).filter((k) => !['order', 'blurb', 'hub'].includes(k)), ['art_ids']);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('real tree: loader derives every per-node file into exactly one art_ids array', () => {
  const loaded = loadHubCategories(REPO);
  const dir = join(REPO, 'chaingraph', 'hub-categories');
  const stems = readdirSync(dir).filter((x) => x.endsWith('.json')).map((x) => x.slice(0, -'.json'.length));
  const mapped = Object.values(loaded).flatMap((c) => c.art_ids);
  assert.equal(mapped.length, stems.length, 'every per-node file maps into exactly one art_ids array');
  assert.equal(new Set(mapped).size, stems.length, 'no per-node file maps twice');
  for (const [title, entry] of Object.entries(loaded)) {
    assert.equal(typeof entry.order, 'number', `${title} keeps a numeric order`);
    assert.ok(Array.isArray(entry.art_ids), `${title} keeps a derived art_ids array`);
    assert.equal(entry.hubs, undefined, `${title} carries no hubs key — the loader output is unchanged`);
  }
});

test('real tree: resolveNodeHubs() parses the seeded data without throwing', () => {
  const resolved = resolveNodeHubs(REPO);
  const sources = new Set([...resolved.values()].map((e) => e.source));
  for (const s of sources) assert.ok(['node', 'cluster', 'exempt', 'none'].includes(s), `source ${s} is in the enum`);
  for (const [id, entry] of resolved) {
    assert.ok(Array.isArray(entry.hubs), `${id} carries a hubs array`);
    if (entry.source === 'exempt') assert.ok(entry.exempt_reason && entry.exempt_reason.length, `${id} exempt carries a reason`);
  }
});
