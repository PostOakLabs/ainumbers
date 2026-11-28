// Unit test for scripts/mq-eject-classify.mjs. No network, no gh.
import assert from 'node:assert/strict';
import test from 'node:test';
import { classify } from './mq-eject-classify.mjs';

const GATES = ['derived-artifacts-check', 'sitemap-check'];

// #3365 (merge_group run 46093092596): every shard cancelled, `required` failed
// only because a leg reported `cancelled`; no gate printed a red.
const LOG_3365 = [
  'Full preflight gate suite - shard 0/4\tRun gates\tThe operation was canceled.',
  'scripts-verify / required\tCheck legs\tRESULT: cancelled',
  "scripts-verify / required\tCheck legs\t##[error]a required leg reported 'cancelled' (not success/skipped)",
].join('\n');

test('#3365 log shape is cancelled-leg', () => {
  assert.deepEqual(classify(LOG_3365, GATES), { kind: 'cancelled-leg', gates: [] });
});

test('cancelled leg plus a real failed gate stays other', () => {
  const log = `${LOG_3365}\n✗ some-gate FAILED at: scripts/some-gate.mjs`;
  assert.equal(classify(log, GATES).kind, 'other');
});

test('cancelled leg plus a derived-gate failure stays derived-gate', () => {
  const log = `${LOG_3365}\n✗ node scripts/sitemap-check.mjs RED`;
  assert.deepEqual(classify(log, GATES), { kind: 'derived-gate', gates: ['sitemap-check'] });
});

test('cancelled leg plus a bare step error stays other', () => {
  assert.equal(classify(`${LOG_3365}\n##[error]Process completed with exit code 1.`, GATES).kind, 'other');
});

test('checkout-fatal wins and is unchanged', () => {
  const log = `${LOG_3365}\nfatal: 'refs/remotes/origin/gh-readonly-queue/main/pr-1-abc' is not a commit`;
  assert.deepEqual(classify(log, GATES), { kind: 'checkout-fatal', gates: [] });
});

test('empty log is other', () => {
  assert.deepEqual(classify('', GATES), { kind: 'other', gates: [] });
});
