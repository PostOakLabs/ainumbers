// MQ-EJECT-HOLD-1: unit test for scripts/mq-eject-hold.mjs. No network, no gh.
import assert from 'node:assert/strict';
import test from 'node:test';
import { holdComment, isHoldComment, recordedSha, isHeld, LABEL } from './mq-eject-hold.mjs';

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
