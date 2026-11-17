// Tests for scripts/lib/preflight-shard.mjs (CI-PREFLIGHT-SHARD-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShardSpec, planShards } from './preflight-shard.mjs';

const LABELS = [
  'JS syntax', 'Property-testing floor', 'Mutation tier floor (MUTATION-TIERED-ROLLOUT-1, touched kernels)',
  'VM↔worker parity (§24)', 'Copy hallmarks (§1.4)', 'Nav reachability', 'Server card schema conformance',
  'mfstSec presence (every tool)', 'Duplicate label', 'Duplicate label', 'Binary/control bytes',
];
const TIMINGS = { 'Property-testing floor': 444333, 'VM↔worker parity (§24)': 132275, 'Nav reachability': 73863, 'JS syntax': 900 };
const pinned = (l) => l.startsWith('Mutation tier floor') || l === 'mfstSec presence (every tool)';

// The union-equals-whole property, stated the way preflight's --shard-plan checks it.
function assertPartition(labels, count, plan) {
  assert.equal(plan.length, labels.length);
  const union = [];
  for (let s = 0; s < count; s++) labels.forEach((l, i) => { if (plan[i] === s) union.push(l); });
  assert.deepEqual([...union].sort(), [...labels].sort());
  assert.ok(plan.every((s) => Number.isInteger(s) && s >= 0 && s < count));
}

test('parseShardSpec accepts i/N with 0 <= i < N and refuses everything else', () => {
  assert.deepEqual(parseShardSpec('0/4'), { index: 0, count: 4 });
  assert.deepEqual(parseShardSpec('3/4'), { index: 3, count: 4 });
  assert.deepEqual(parseShardSpec('0/1'), { index: 0, count: 1 });
  for (const bad of ['4/4', '1/0', '-1/4', '1', '', undefined, 'a/b', '1/4/2', ' 1/4']) assert.equal(parseShardSpec(bad), null, String(bad));
});

test('every label lands in exactly one shard, with and without timings, for N = 1..6', () => {
  for (let n = 1; n <= 6; n++) {
    assertPartition(LABELS, n, planShards(LABELS, n, { pinned }));
    assertPartition(LABELS, n, planShards(LABELS, n, { timings: TIMINGS, pinned }));
  }
});

test('pinned entries always go to shard 0', () => {
  for (const timings of [null, TIMINGS]) {
    const plan = planShards(LABELS, 4, { timings, pinned });
    LABELS.forEach((l, i) => { if (pinned(l)) assert.equal(plan[i], 0, l); });
  }
});

test('the plan is independent of declaration order (every shard derives the same one)', () => {
  const shuffled = [...LABELS].reverse();
  for (const timings of [null, TIMINGS]) {
    const a = planShards(LABELS, 4, { timings, pinned });
    const b = planShards(shuffled, 4, { timings, pinned });
    const owner = (labels, plan) => labels.map((l, i) => `${l}=${plan[i]}`).sort();
    // Duplicate labels may swap shards with each other; the multiset of owners is what must match.
    assert.deepEqual(owner(LABELS, a), owner(shuffled, b));
  }
});

test('timings balance: the heaviest gate gets a shard to itself when the rest fit elsewhere', () => {
  const plan = planShards(LABELS, 4, { timings: TIMINGS, pinned });
  const heavy = plan[LABELS.indexOf('Property-testing floor')];
  assert.notEqual(heavy, 0, 'shard 0 carries the pinned entries, so the heaviest gate goes elsewhere');
  assert.deepEqual(LABELS.filter((_, i) => plan[i] === heavy), ['Property-testing floor']);
});

test('without timings the split is round-robin over label order', () => {
  const plan = planShards(['c', 'a', 'b', 'd'], 2);
  assert.deepEqual(plan, [0, 0, 1, 1]); // sorted a,b,c,d -> 0,1,0,1
});
