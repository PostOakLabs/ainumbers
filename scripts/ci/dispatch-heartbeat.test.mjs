// Unit test for scripts/ci/dispatch-heartbeat.mjs. No network, no gh.
import assert from 'node:assert/strict';
import test from 'node:test';
import { heartbeat, readRuns, DRAIN_WORKFLOWS, QUIET_MINUTES } from './dispatch-heartbeat.mjs';

const NOW = '2026-11-25T13:00:00Z';
const run = (workflow, event, created_at) => ({ workflow, event, created_at });

test('a dispatch 20 minutes ago: green', () => {
  const v = heartbeat([run('pr-autofix.yml', 'workflow_dispatch', '2026-11-25T12:40:00Z')], NOW);
  assert.equal(v.state, 'green');
  assert.equal(v.ageMinutes, 20);
  assert.equal(v.workflow, 'pr-autofix.yml');
});

test('newest driven run over an hour old: red, naming it', () => {
  const v = heartbeat([
    run('auto-arm.yml', 'workflow_dispatch', '2026-11-25T11:10:00Z'),
    run('automerge-label.yml', 'schedule', '2026-11-25T11:45:00Z'),
  ], NOW);
  assert.equal(v.state, 'red');
  assert.equal(v.ageMinutes, 75);
  assert.match(v.line, /quiet 75 min \(over 60\).*automerge-label\.yml at 2026-11-25T11:45:00Z/);
});

test('exactly the limit is still green; one minute over is red', () => {
  assert.equal(heartbeat([run('auto-arm.yml', 'schedule', '2026-11-25T12:00:00Z')], NOW).state, 'green');
  assert.equal(heartbeat([run('auto-arm.yml', 'schedule', '2026-11-25T11:59:00Z')], NOW).state, 'red');
  assert.equal(QUIET_MINUTES, 60);
});

test('push, pull_request and other runs do not count as the drain being driven', () => {
  const v = heartbeat([
    run('pr-autofix.yml', 'push', '2026-11-25T12:59:00Z'),
    run('automerge-label.yml', 'pull_request', '2026-11-25T12:58:00Z'),
    run('auto-arm.yml', 'workflow_dispatch', '2026-11-25T10:00:00Z'),
  ], NOW);
  assert.equal(v.state, 'red');
  assert.equal(v.workflow, 'auto-arm.yml');
});

test('nothing readable: red', () => {
  assert.equal(heartbeat([], NOW).state, 'red');
  assert.equal(heartbeat(null, NOW).newest, null);
  assert.equal(heartbeat([run('auto-arm.yml', 'schedule', 'not a date')], NOW).state, 'red');
});

test('readRuns asks for schedule and dispatch runs of every drain workflow; failures are skipped', () => {
  const calls = [];
  const gh = (args) => {
    calls.push(args[1]);
    if (args[1].includes('auto-arm.yml')) throw new Error('404');
    return [{ event: args[1].includes('schedule') ? 'schedule' : 'workflow_dispatch', created_at: '2026-11-25T12:30:00Z' }];
  };
  const runs = readRuns('o/r', gh);
  assert.equal(calls.length, DRAIN_WORKFLOWS.length * 2);
  assert.ok(calls.every((c) => c.startsWith('repos/o/r/actions/workflows/')));
  assert.equal(runs.length, 4);
  assert.ok(runs.every((r) => r.workflow !== 'auto-arm.yml'));
});
