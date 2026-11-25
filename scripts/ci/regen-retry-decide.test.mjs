// Unit test for scripts/ci/regen-retry-decide.mjs. No network, no gh.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { retryDecision, failedSteps } from './regen-retry-decide.mjs';

const job = (conclusion, steps) => ({ conclusion, steps: steps.map(([name, c]) => ({ name, conclusion: c })) });

// Shape of the 2026-11-25 reds: the regen job fails in the fixpoint proof.
const fixpointRed = {
  jobs: [job('failure', [
    ['Set up job', 'success'],
    ['Checkout main', 'success'],
    ['Regenerate every covered artifact', 'success'],
    ['Prove the regen pass was a fixpoint (every covered freshness gate)', 'failure'],
    ['Commit and push', 'skipped'],
  ])],
};

test('gate red (fixpoint proof): no retry, the alarm alone runs', () => {
  const d = retryDecision(fixpointRed);
  assert.equal(d.retry, false);
  assert.equal(d.reason, 'gate-failed:Prove the regen pass was a fixpoint (every covered freshness gate)');
});

test('copy gate red: no retry', () => {
  const d = retryDecision({ jobs: [job('failure', [['Validate the regenerated reader-facing copy (CONTRACT.md §1.4)', 'failure']])] });
  assert.equal(d.retry, false);
});

test('push race or token mint failure: retry', () => {
  assert.equal(retryDecision({ jobs: [job('failure', [['Commit and push', 'failure']])] }).reason, 'transient-step');
  assert.equal(retryDecision({ jobs: [job('failure', [['Mint push token', 'failure']])] }).retry, true);
  assert.equal(retryDecision({ jobs: [job('failure', [['Checkout main', 'failure']])] }).retry, true);
});

test('runner lost (failed job with no failed step): retry', () => {
  const d = retryDecision({ jobs: [job('failure', [['Set up job', 'success'], ['Regenerate every covered artifact', 'cancelled']])] });
  assert.deepEqual(d, { retry: true, reason: 'no-failed-step', failedSteps: [] });
});

test('one transient and one gate step: the gate wins', () => {
  const d = retryDecision({ jobs: [
    job('failure', [['Commit and push', 'failure']]),
    job('failure', [['Refuse a mass deletion', 'failure']]),
  ] });
  assert.equal(d.retry, false);
  assert.equal(d.reason, 'gate-failed:Refuse a mass deletion');
});

test('a step not listed counts as a gate; green jobs are ignored', () => {
  assert.equal(retryDecision({ jobs: [job('failure', [['Some new step', 'failure']])] }).retry, false);
  assert.deepEqual(failedSteps({ jobs: [job('success', [['Prove x', 'failure']])] }), []);
});

test('unreadable payload retries (old behaviour)', () => {
  assert.equal(retryDecision(null).reason, 'jobs-unreadable');
  assert.equal(retryDecision({}).retry, true);
});

test('CLI: exit 1 on a gate red, 0 on a transient one', () => {
  const cli = fileURLToPath(new URL('./regen-retry-decide.mjs', import.meta.url));
  assert.throws(() => execFileSync('node', [cli], { input: JSON.stringify(fixpointRed) }), (e) => e.status === 1);
  const out = execFileSync('node', [cli], { input: JSON.stringify({ jobs: [job('failure', [['Commit and push', 'failure']])] }) });
  assert.equal(JSON.parse(String(out)).retry, true);
});
