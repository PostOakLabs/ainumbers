// Fixture tests for auto-arm.mjs decide(): one GREEN case plus a RED case for
// each of conditions (a)-(f), and the serial baton order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, isLineageClass, lineageKind, sharedFiles, parallelSlotBlocker, SHARED_RESIDUAL } from './auto-arm.mjs';

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

// ---- parallel mainside slots (opt-in via ctx.lineageParallel) ----
const K = (n) => `chaingraph/kernels/art-${n}.mjs`;
const par = { max: 2 };
const armed = (...nums) => nums.map((n) => ({ number: 100 + n, files: [K(n)] }));
const mk = (n, extra = []) => mkPr({ number: n, branch: n === 1 ? 'k1' : 'k2', files: [K(n), ...extra] });

test('lineageKind: mainside, serial, none', () => {
  assert.equal(lineageKind([K(1), 'tools/1.html']), 'mainside');
  assert.equal(lineageKind([K(1), 'registry/kernel/a.json']), 'serial');
  assert.equal(lineageKind([K(1), 'chaingraph/kernels/registry-lineage-records.json']), 'serial');
  assert.equal(lineageKind([K(1), 'chaingraph/receipt-bundles/1-x.bundle.json']), 'serial');
  assert.equal(lineageKind([K(1), ...Array.from({ length: 99 }, (_, i) => `tools/${i}.html`)]), 'serial');
  assert.equal(lineageKind(['tools/1.html']), 'none');
  assert.equal(lineageKind(['chaingraph/receipt-bundles/1-x.bundle.json']), 'none');
});
test('sharedFiles counts the residual files whenever either PR touches them', () => {
  assert.deepEqual(sharedFiles([K(1)], [K(2)]), []);
  assert.deepEqual(sharedFiles([K(1), 'x'], [K(2), 'x']), ['x']);
  for (const r of SHARED_RESIDUAL) {
    assert.deepEqual(sharedFiles([K(1), r], [K(2)]), [r]);
    assert.deepEqual(sharedFiles([K(1)], [K(2), r]), [r]);
  }
});
test('parallel OFF (default): a second mainside lineage PR still waits behind the baton and an armed PR', () => {
  const k2 = mk(2);
  assert.match(decide(k2, green, mkCtx({ armedLineage: armed(1), otherLineageArmed: true })).reason, /baton-held-by:k1/);
  const k1 = mk(1);
  assert.equal(decide(k1, green, mkCtx({ armedLineage: armed(9), otherLineageArmed: true })).action, 'wait');
});
test('parallel ON: mainside PR skips the baton and arms beside one other mainside PR', () => {
  const k2 = mk(2);
  const r = decide(k2, green, mkCtx({ lineageParallel: par, armedLineage: armed(1), otherLineageArmed: true }));
  assert.equal(r.action, 'arm'); assert.match(r.reason, /lineage-parallel/);
  assert.equal(decide(k2, green, mkCtx({ lineageParallel: par, armedLineage: [], otherLineageArmed: false })).action, 'arm');
});
test('parallel ON: max armed reached, serial armed, residual overlap and file overlap all wait', () => {
  const k2 = mk(2);
  const full = decide(k2, green, mkCtx({ lineageParallel: par, armedLineage: armed(1, 3), otherLineageArmed: true }));
  assert.match(full.reason, /^lineage-parallel-full:2[/]2$/);
  const ser = [{ number: 150, files: [K(7), 'registry/kernel/z.json'] }];
  assert.match(decide(k2, green, mkCtx({ lineageParallel: par, armedLineage: ser, otherLineageArmed: true })).reason, /^another-lineage-pr-armed-or-queued:#150/);
  const resid = decide(mk(2, [SHARED_RESIDUAL[0]]), green, mkCtx({ lineageParallel: par, armedLineage: armed(1), otherLineageArmed: true }));
  assert.match(resid.reason, /^lineage-overlap-with:#101:/);
  const theirs = [{ number: 160, files: [K(8), SHARED_RESIDUAL[2]] }];
  assert.match(decide(k2, green, mkCtx({ lineageParallel: par, armedLineage: theirs, otherLineageArmed: true })).reason, /^lineage-overlap-with:#160:/);
  const same = [{ number: 170, files: [K(8), 'tools/shared.html'] }];
  assert.match(decide(mk(2, ['tools/shared.html']), green, mkCtx({ lineageParallel: par, armedLineage: same, otherLineageArmed: true })).reason, /^lineage-overlap-with:#170:tools[/]shared.html/);
});
test('parallel ON: a serial-class PR keeps the baton and needs zero other lineage PRs armed', () => {
  const k1 = mkPr({ number: 1, branch: 'k1', files: [K(1), 'registry/kernel/a.json'] });
  assert.equal(decide(k1, green, mkCtx({ lineageParallel: par, armedLineage: [], otherLineageArmed: false })).action, 'arm');
  assert.equal(decide(k1, green, mkCtx({ lineageParallel: par, armedLineage: armed(5), otherLineageArmed: true })).action, 'wait');
  const k2 = mkPr({ number: 2, branch: 'k2', files: [K(2), 'registry/kernel/b.json'] });
  assert.match(decide(k2, green, mkCtx({ lineageParallel: par })).reason, /baton-held-by:k1/);
});
test('parallel ON without an armed list fails closed', () => {
  assert.equal(decide(mk(2), green, mkCtx({ lineageParallel: par, otherLineageArmed: true })).action, 'wait');
});
test('parallel ON: the other gates (checks, stale ref, draft) still apply to a mainside PR', () => {
  const k2 = mk(2);
  assert.equal(decide(k2, [{ name: 'ci', bucket: 'fail' }], mkCtx({ lineageParallel: par })).action, 'wait');
  assert.equal(decide(k2, green, mkCtx({ lineageParallel: par, mergeFirstParent: 'bbbb' })).action, 'update-branch');
  assert.equal(decide(mk(2), green, mkCtx({ lineageParallel: par })).action, 'arm');
});
test('parallelSlotBlocker ignores the PR itself', () => {
  assert.equal(parallelSlotBlocker({ number: 101, files: [K(1)] }, armed(1)), null);
});
