// Unit test for scripts/mq-eject-hold.mjs. No network, no gh.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  holdComment, isHoldComment, recordedSha, isHeld, LABEL, pickEjectRun, findEjectRun,
  recordedClass, ownDiffMoved, clearVerdict, prDiff, newestHoldComment,
} from './mq-eject-hold.mjs';

const info = { workflow: 'scripts-verify', step: 'Run gates', runId: '123', sha: 'abc1234def' };

test('dequeued-for-failure: comment names workflow, step, run and head', () => {
  const body = holdComment(info);
  assert.ok(isHoldComment(body));
  for (const s of ['scripts-verify', 'Run gates', '123', 'abc1234def']) assert.ok(body.includes(s), s);
  assert.equal(recordedSha(body), 'abc1234def');
});

test('same head with label: held (rearm-recovered skips)', () => {
  assert.equal(isHeld(['automerge', LABEL], 'abc1234def', holdComment(info)), true);
});

test('new head: not held (synchronize clears the label)', () => {
  assert.equal(isHeld(['automerge', LABEL], 'fff9999', holdComment(info)), false);
});

test('override: label removed by hand, same head re-arms once', () => {
  assert.equal(isHeld(['automerge'], 'abc1234def', holdComment(info)), false);
});

test('unrelated comment records no sha', () => {
  assert.equal(recordedSha('auto-merge enabled by automerge-label.yml'), null);
  assert.equal(isHeld([LABEL], 'abc1234def', 'nothing here'), false);
});

// MQ-EJECT-CANCELLED-RUN-1. Fixture: the real merge_group group that ejected
// #3222 at 2026-11-23T13:36:05Z (main 3ee41a01). Scripts Verify concluded
// `cancelled` although its job `scripts-verify / required` concluded `failure`;
// every other workflow in the group was green. A #3265 group is mixed in.
const G = 'gh-readonly-queue/main/pr-3222-3ee41a016f5536b7a4b5bb30039fdbc9fc1d9cf8';
const runs3222 = [
  { id: 45184774616, head_branch: G, created_at: '2026-11-23T13:31:31Z', status: 'completed', conclusion: 'success' },
  { id: 45184774645, head_branch: G, created_at: '2026-11-23T13:31:31Z', status: 'completed', conclusion: 'success' },
  { id: 45184774739, head_branch: G, created_at: '2026-11-23T13:31:31Z', status: 'completed', conclusion: 'success' },
  { id: 45184774612, head_branch: G, created_at: '2026-11-23T13:31:31Z', status: 'completed', conclusion: 'cancelled' },
  { id: 45184774824, head_branch: G, created_at: '2026-11-23T13:31:31Z', status: 'completed', conclusion: 'success' },
  { id: 45187369080, head_branch: 'gh-readonly-queue/main/pr-3265-82180404a9ced0c439222df38029b0a08e699fa4',
    created_at: '2026-11-23T13:47:11Z', status: 'completed', conclusion: 'cancelled' },
];
const failedJobs = new Set([45184774612, 45187369080]);
const hasFailedJob = (id) => failedJobs.has(id);

test('cancelled run with a failed job is the ejecting run (#3222 replay)', () => {
  // The old lookup (status=failure) finds nothing in this group.
  assert.equal(runs3222.filter((r) => r.head_branch.startsWith('gh-readonly-queue/main/pr-3222-') && r.conclusion === 'failure').length, 0);
  assert.equal(pickEjectRun(runs3222, 3222, hasFailedJob), 45184774612);
});

test('a run that concluded failure is picked without a jobs read', () => {
  const r = [{ id: 7, head_branch: 'gh-readonly-queue/main/pr-3224-728c', created_at: '2026-11-22T01:55:34Z', status: 'completed', conclusion: 'failure' }];
  assert.equal(pickEjectRun(r, 3224, () => { throw new Error('no jobs read expected'); }), 7);
});

test('cancelled run with no failed job (group rebuilt) is not an ejection', () => {
  assert.equal(pickEjectRun(runs3222, 3222, () => false), null);
});

test('unfinished run with a failed job counts; another PR prefix never does', () => {
  const r = [{ id: 9, head_branch: 'gh-readonly-queue/main/pr-32220-aaaa', created_at: '2026-11-23T14:00:00Z', status: 'completed', conclusion: 'failure' },
    { id: 8, head_branch: 'gh-readonly-queue/main/pr-3222-bbbb', created_at: '2026-11-23T13:59:00Z', status: 'in_progress', conclusion: null }];
  assert.equal(pickEjectRun(r, 3222, (id) => id === 8), 8);
});

test('newest qualifying group wins', () => {
  const r = [
    { id: 1, head_branch: 'gh-readonly-queue/main/pr-5-old', created_at: '2026-11-23T10:00:00Z', status: 'completed', conclusion: 'failure' },
    { id: 2, head_branch: 'gh-readonly-queue/main/pr-5-new', created_at: '2026-11-23T11:00:00Z', status: 'completed', conclusion: 'cancelled' },
  ];
  assert.equal(pickEjectRun(r, 5, () => true), 2);
});

test('findEjectRun asks for every merge_group run, not status=failure only', () => {
  const calls = [];
  const gh = (args) => {
    calls.push(args[1]);
    if (args[1].includes('/jobs')) return failedJobs.has(Number(args[1].split('/runs/')[1].split('/')[0])) ? [1] : [];
    return runs3222;
  };
  assert.equal(findEjectRun('PostOakLabs/ainumbers', '3222', gh), 45184774612);
  assert.ok(!calls[0].includes('status=failure'), calls[0]);
});

// MQ-EJECT-HOLD-OWN-CHANGE-1. Replay of #3278 (2026-11-25): ejected 09:33 for a
// dead link in its own page, then a merge-from-main at 09:55:58 cleared the hold
// and the same change was re-armed at 10:34. The PR's own diff did not move.
const own = [
  { filename: 'tools/700-x.html', status: 'modified', sha: 'b1' },
  { filename: 'manifests/700-x.manifest.json', status: 'added', sha: 'b2' },
];
const diff = (files) => ({ files, complete: true });
const otherHold = holdComment({ ...info, kind: 'other' });
const derivedHold = holdComment({ ...info, kind: 'derived-gate' });

test('hold comment records the eject class; old comments have none', () => {
  assert.equal(recordedClass(otherHold), 'other');
  assert.equal(recordedClass(derivedHold), 'derived-gate');
  assert.equal(recordedClass(holdComment(info)), null);
  assert.equal(recordedSha(derivedHold), 'abc1234def');
  assert.ok(derivedHold.includes('merge main in'));
  assert.ok(otherHold.includes('a merge from main alone does not'));
});

test('#3278 replay: refresh from main only keeps a PR-owned eject held', () => {
  const v = clearVerdict({ holdBody: otherHold, before: diff(own), after: diff(own.map((f) => ({ ...f }))) });
  assert.deepEqual(v, { clear: false, reason: 'main-refresh-only:other' });
});

test('old hold comment with no class is kept on a main refresh', () => {
  const v = clearVerdict({ holdBody: holdComment(info), before: diff(own), after: diff(own) });
  assert.deepEqual(v, { clear: false, reason: 'main-refresh-only:unclassified' });
});

test('own file content changed: clear', () => {
  const after = [{ ...own[0], sha: 'b9' }, own[1]];
  assert.equal(clearVerdict({ holdBody: otherHold, before: diff(own), after: diff(after) }).reason, 'own-files-changed');
});

test('own file added, removed or renamed: clear', () => {
  assert.ok(ownDiffMoved(own, [...own, { filename: 'scripts/a.mjs', status: 'added', sha: 'c1' }]));
  assert.ok(ownDiffMoved(own, own.slice(0, 1)));
  assert.ok(ownDiffMoved(own, [own[0], { filename: 'manifests/701.json', status: 'renamed', sha: 'b2', previous_filename: 'manifests/700-x.manifest.json' }]));
  assert.ok(!ownDiffMoved(own, [...own].reverse()));
});

test('eject caused by main moving on (derived-gate): a main refresh clears', () => {
  const v = clearVerdict({ holdBody: derivedHold, before: diff(own), after: diff(own) });
  assert.deepEqual(v, { clear: true, reason: 'eject-from-main-move:derived-gate' });
});

test('unknown inputs clear, as before', () => {
  assert.equal(clearVerdict({ holdBody: null, before: diff(own), after: diff(own) }).reason, 'no-hold-record');
  assert.equal(clearVerdict({ holdBody: otherHold, before: null, after: diff(own) }).reason, 'own-diff-unknown');
  assert.equal(clearVerdict({ holdBody: otherHold, before: diff(own), after: { files: own, complete: false } }).reason, 'own-diff-unknown');
});

test('prDiff and newestHoldComment: fake gh, failures read as unknown', () => {
  const calls = [];
  const gh = (args) => { calls.push(args.join(' ')); return own; };
  assert.deepEqual(prDiff('o/r', 'main', 'abc', gh), { files: own, complete: true });
  assert.ok(calls[0].includes('repos/o/r/compare/main...abc'), calls[0]);
  const many = Array.from({ length: 300 }, (_, i) => ({ filename: `f${i}`, status: 'added', sha: `${i}` }));
  assert.equal(prDiff('o/r', 'main', 'abc', () => many).complete, false);
  assert.equal(prDiff('o/r', 'main', 'abc', () => { throw new Error('404'); }), null);
  const bodies = ['hello', holdComment(info), 'lgtm', derivedHold];
  assert.equal(newestHoldComment('o/r', 1, () => bodies), derivedHold);
  assert.equal(newestHoldComment('o/r', 1, () => ['hi']), null);
  assert.equal(newestHoldComment('o/r', 1, () => { throw new Error('x'); }), null);
});
