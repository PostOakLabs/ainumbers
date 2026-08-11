#!/usr/bin/env node
// lib-shard-order.test.mjs — proven-to-catch fixture for CHAINORDER-GATE-1.
//
// PACKS-ASSEMBLE-LAND-2 found two chain shards (PACKS-MUNI-1 PR #1062,
// PACKS-SEC16-1 PR #1063) merged to main and absent from
// chaingraph.meta.json's order.chains, invisible to every gate. This feeds
// findUnlistedShards() a deliberately-reproduced version of that exact
// state (a chain shard id on disk, absent from order.chains) and asserts it
// is caught, then asserts it goes clean once the id is appended — the
// red-then-green sequence CHAINORDER-GATE-1 requires. Also covers the
// reverse direction (findOrphanOrderEntries): an order.* entry with no
// shard file behind it.

import { findUnlistedShards, findOrphanOrderEntries } from './lib-shard-order.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---- Reproduce the 2026-08-08 condition: PACKS-SEC16-1 merged, shard file
// present, order.chains never got the append. ----
const ON_DISK_CHAINS = ['bond-yield-composer', 'muni-tax-equiv-composer', 'sec16-filing-composer'];
const ORDER_CHAINS_BEFORE_FIX = ['bond-yield-composer', 'muni-tax-equiv-composer']; // sec16 missing

test('RED — catches a merged chain shard absent from order.chains (the PACKS-SEC16-1 case)', () => {
  const extra = findUnlistedShards(ON_DISK_CHAINS, ORDER_CHAINS_BEFORE_FIX);
  assert(extra.length === 1, `expected 1 unlisted shard, got ${extra.length}`);
  assert(extra[0] === 'sec16-filing-composer', `expected sec16-filing-composer, got ${JSON.stringify(extra)}`);
});

test('GREEN — clean once the shard id is appended to order.chains', () => {
  const orderChainsAfterFix = [...ORDER_CHAINS_BEFORE_FIX, 'sec16-filing-composer'];
  const extra = findUnlistedShards(ON_DISK_CHAINS, orderChainsAfterFix);
  assert(extra.length === 0, `expected 0 unlisted shards after fix, got ${JSON.stringify(extra)}`);
});

test('node shards use the same function — a same-shaped node gap is caught too', () => {
  const onDiskNodes = ['art-01', 'art-02', 'art-03'];
  const orderNodes = ['art-01', 'art-02'];
  const extra = findUnlistedShards(onDiskNodes, orderNodes);
  assert(extra.length === 1 && extra[0] === 'art-03', `expected [art-03], got ${JSON.stringify(extra)}`);
});

test('empty disk / empty order both report clean', () => {
  assert(findUnlistedShards([], []).length === 0, 'expected no extras on empty input');
});

// ---- Reverse direction: order.* names a shard with no file behind it. ----
test('orphan order entry (no shard file) is caught', () => {
  const orderChains = ['bond-yield-composer', 'ghost-composer'];
  const onDisk = ['bond-yield-composer'];
  const orphans = findOrphanOrderEntries(orderChains, onDisk);
  assert(orphans.length === 1 && orphans[0] === 'ghost-composer', `expected [ghost-composer], got ${JSON.stringify(orphans)}`);
});

test('no orphans when every order.* entry has a shard file', () => {
  const orderChains = ['bond-yield-composer', 'muni-tax-equiv-composer'];
  const onDisk = ['bond-yield-composer', 'muni-tax-equiv-composer', 'sec16-filing-composer'];
  const orphans = findOrphanOrderEntries(orderChains, onDisk);
  assert(orphans.length === 0, `expected no orphans, got ${JSON.stringify(orphans)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
