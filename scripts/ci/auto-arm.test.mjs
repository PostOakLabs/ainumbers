// Fixture tests for auto-arm.mjs decide(): one GREEN case plus a RED case for
// each of conditions (a)-(f), and the serial baton order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, isLineageClass } from './auto-arm.mjs';

const TIP = 'aaaa';
const green = [{ name: 'ci', bucket: 'pass' }, { name: 'lint', bucket: 'skipping' }];
const mkPr = (o = {}) => ({ number: 1, branch: 'b1', isDraft: false, labels: [], files: ['tools/x.html'], ...o });
const mkCtx = (o = {}) => ({
  allow: { prs: { b1: 'ROW-1', k1: 'ROW-K1', k2: 'ROW-K2' }, lineage: ['k1', 'k2'] },
  mainTip: TIP, mergeFirstParent: TIP, openBranches: ['b1', 'k1', 'k2'], otherLineageArmed: false, ...o,
});

test('GREEN: allowlisted, green, fresh -> arm', () => {
  assert.equal(decide(mkPr(), green, mkCtx()).action, 'arm');
});
test('(a) RED: a required check failing/pending -> wait', () => {
  const r = decide(mkPr(), [{ name: 'ci', bucket: 'fail' }], mkCtx());
  assert.equal(r.action, 'wait'); assert.match(r.reason, /ci=fail/);
  assert.match(decide(mkPr(), [{ name: 'ci', bucket: 'pending' }], mkCtx()).reason, /ci=pending/);
  assert.equal(decide(mkPr(), [], mkCtx()).reason, 'no-required-checks-reported');
});
test('(b) RED: stale merge ref -> update-branch; missing ref -> update-branch', () => {
  assert.equal(decide(mkPr(), green, mkCtx({ mergeFirstParent: 'bbbb' })).action, 'update-branch');
  assert.equal(decide(mkPr(), green, mkCtx({ mergeFirstParent: null })).action, 'update-branch');
});
test('(b) not-green stale PR waits, does not update', () => {
  assert.equal(decide(mkPr(), [{ name: 'ci', bucket: 'fail' }], mkCtx({ mergeFirstParent: 'bbbb' })).action, 'wait');
});
test('(c) RED: branch not in allowlist -> skip, never touched', () => {
  assert.equal(decide(mkPr({ branch: 'rogue' }), green, mkCtx()).action, 'skip');
});
test('(d) RED: touches .github/workflows -> wait', () => {
  const r = decide(mkPr({ files: ['.github/workflows/x.yml'] }), green, mkCtx());
  assert.equal(r.action, 'wait'); assert.match(r.reason, /workflows/);
});
test('(e) RED: lineage PR with another lineage PR armed/queued -> wait', () => {
  const pr = mkPr({ branch: 'k1', files: ['chaingraph/kernels/a.mjs'] });
  assert.equal(decide(pr, green, mkCtx()).action, 'arm');
  assert.equal(decide(pr, green, mkCtx({ otherLineageArmed: true })).action, 'wait');
  assert.equal(decide(mkPr({ branch: 'k1', files: ['registry/r.json'] }), green, mkCtx({ otherLineageArmed: true })).action, 'wait');
});
test('(e) non-lineage PR is not blocked by an armed lineage PR', () => {
  assert.equal(decide(mkPr(), green, mkCtx({ otherLineageArmed: true })).action, 'arm');
});
test('(f) RED: draft, hold label -> wait', () => {
  assert.equal(decide(mkPr({ isDraft: true }), green, mkCtx()).reason, 'draft');
  assert.equal(decide(mkPr({ labels: ['hold'] }), green, mkCtx()).reason, 'hold-label');
});
test('already labelled -> wait, labels never removed', () => {
  assert.equal(decide(mkPr({ labels: ['automerge'] }), green, mkCtx()).reason, 'already-labelled');
});
test('BATON: only first open lineage branch arms; next arms after first leaves', () => {
  const k1 = mkPr({ number: 11, branch: 'k1', files: ['chaingraph/kernels/a.mjs'] });
  const k2 = mkPr({ number: 12, branch: 'k2', files: ['registry/b.json'] });
  assert.equal(decide(k2, green, mkCtx()).action, 'wait');
  assert.match(decide(k2, green, mkCtx()).reason, /baton-held-by:k1/);
  assert.equal(decide(k1, green, mkCtx()).action, 'arm');
  // k1 merged: no longer open -> k2 is first
  assert.equal(decide(k2, green, mkCtx({ openBranches: ['b1', 'k2'] })).action, 'arm');
});
test('isLineageClass', () => {
  assert.equal(isLineageClass(['chaingraph/kernels/x.mjs']), true);
  assert.equal(isLineageClass(['registry/x']), true);
  assert.equal(isLineageClass(['tools/x.html']), false);
});
