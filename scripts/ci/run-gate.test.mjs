/**
 * scripts/ci/run-gate.test.mjs — CI-THIN-YAML-1 fixture test.
 *
 * Proves, from OUTSIDE the module, that scripts/ci/run-gate.mjs resolves the
 * SAME env the YAML steps it replaced used to set — for a pull_request-shaped
 * run (only $RUNNER_TEMP/s18-derived-root.txt exists) and a merge_group-shaped
 * run (only $RUNNER_TEMP/derived-root.txt exists). Pure and fast: no gate is
 * executed, no tree is touched; the resolution is read through --plan.
 *
 * The authoritative before/after table is the gate table in run-gate.mjs,
 * transcribed 1:1 from land-verify.yml / scripts-verify.yml at the
 * thin-YAML 2026-11-01 base.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_GATE = join(HERE, 'run-gate.mjs');

function plan(gate, eventName, files) {
  const dir = mkdtempSync(join(tmpdir(), 'run-gate-fixture-'));
  for (const [f, v] of Object.entries(files)) writeFileSync(join(dir, f), v + '\n');
  try {
    const out = execFileSync(process.execPath, [RUN_GATE, '--plan', gate], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: eventName, RUNNER_TEMP: dir },
    });
    return JSON.parse(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
import { rmSync } from 'node:fs';

test('pull_request context: §18 coverage reads the s18 tree and presents push, exactly as the YAML did', () => {
  const p = plan('s18-compute-proof-coverage', 'pull_request', { 's18-derived-root.txt': '/scratch/s18' });
  assert.deepEqual(p.env, { DERIVED_ROOT: '/scratch/s18' });
  assert.equal(p.eventOverride, 'push');
  assert.deepEqual(p.commands, [
    'node scripts/check-compute-proof-coverage.mjs',
    'node scripts/check-compute-proof-coverage.test.mjs',
  ]);
});

test('merge_group context: §18 coverage reads the derived tree with no override, exactly as the YAML did', () => {
  const p = plan('s18-compute-proof-coverage', 'merge_group', { 'derived-root.txt': '/scratch/derived' });
  assert.deepEqual(p.env, { DERIVED_ROOT: '/scratch/derived' });
  assert.equal(p.eventOverride, null);
});

test('pull_request context: preflight keeps DERIVED_ROOT empty (committed tree) and gets the s18 root', () => {
  const p = plan('preflight', 'pull_request', { 's18-derived-root.txt': '/scratch/s18' });
  assert.deepEqual(p.env, { S18_DERIVED_ROOT: '/scratch/s18', DERIVED_ROOT: '' });
  assert.equal(p.eventOverride, null);
});

test('merge_group context: preflight gets the scratch root and the merge_group presentation', () => {
  const p = plan('preflight', 'merge_group', { 'derived-root.txt': '/scratch/derived' });
  assert.deepEqual(p.env, { S18_DERIVED_ROOT: '', DERIVED_ROOT: '/scratch/derived' });
  assert.equal(p.eventOverride, 'merge_group');
});

test('post-regen copy validators: three commands in YAML order under the derived root (merge_group only)', () => {
  const p = plan('post-regen-copy-validators', 'merge_group', { 'derived-root.txt': '/scratch/derived' });
  assert.deepEqual(p.env, { DERIVED_ROOT: '/scratch/derived' });
  assert.deepEqual(p.commands, [
    'node scripts/check-copy-hallmarks.mjs',
    'node scripts/check-shipped-prose.mjs',
    'node scripts/check-copy-hallmarks.mjs --source-shards',
  ]);
});

test('count-drift still delegates to scripts/run-gate.mjs verbatim (the split logic never moved)', () => {
  const p = plan('count-drift', 'merge_group', { 'derived-root.txt': '/scratch/derived' });
  assert.deepEqual(p.env, { DERIVED_ROOT: '/scratch/derived' });
  assert.deepEqual(p.commands, ['node scripts/run-gate.mjs node scripts/verify-counts.mjs --check']);
});

test('missing root files read as empty roots — the committed-tree path never throws', () => {
  const p = plan('s18-digest-freshness', 'push', {});
  assert.deepEqual(p.env, { S18_DERIVED_ROOT: '' });
  assert.equal(p.eventOverride, null);
});

test('unknown gate name exits 2 with the known-gate list', () => {
  let status = null;
  try { execFileSync(process.execPath, [RUN_GATE, '--plan', 'no-such-gate'], { encoding: 'utf8' }); }
  catch (e) { status = e.status; }
  assert.equal(status, 2);
});

test('module self-test passes (the full context matrix)', () => {
  execFileSync(process.execPath, [RUN_GATE, '--self-test'], { stdio: 'inherit' });
});
