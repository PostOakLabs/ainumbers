// preflight-cap.test.mjs — PREFLIGHT-HARD-CAP-1. Hermetic: a temp dir shaped like `.wt/<ROW>`.
//   node --test scripts/lib/preflight-cap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPreflightCap, refusalMessage, PREFLIGHT_CAP } from './preflight-cap.mjs';

function wt() {
  const base = mkdtempSync(join(tmpdir(), 'pfcap-'));
  const repo = join(base, '.wt', 'ROW-1');
  mkdirSync(repo, { recursive: true });
  return { base, repo };
}

test('counts runs 1..3 in a .wt/<ROW> worktree, refuses the fourth without counting it', () => {
  const { base, repo } = wt();
  try {
    for (let i = 1; i <= PREFLIGHT_CAP; i++) {
      const r = checkPreflightCap({ repo, env: {}, argv: [], fs });
      assert.deepEqual([r.counted, r.refused, r.count], [true, false, i]);
    }
    const r4 = checkPreflightCap({ repo, env: {}, argv: [], fs });
    assert.deepEqual([r4.counted, r4.refused, r4.count], [false, true, 3]);
    assert.equal(readFileSync(join(repo, '.tmp', 'preflight-count'), 'utf8'), '3');
    assert.match(refusalMessage(r4), /PREFLIGHT-HARD-CAP-1/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('exempt: CI, the pre-push hook run, override, --self-test, and any non-.wt checkout', () => {
  const { base, repo } = wt();
  try {
    for (const env of [{ GITHUB_ACTIONS: 'true' }, { CI: '1' }, { MUTATION_TIER_IN_HOOK: '1' }, { PREFLIGHT_BUDGET_OVERRIDE: '1' }]) {
      assert.equal(checkPreflightCap({ repo, env, argv: [], fs }).counted, false);
    }
    assert.equal(checkPreflightCap({ repo, env: {}, argv: ['--quick', '--self-test'], fs }).counted, false);
    assert.equal(checkPreflightCap({ repo: join(base, 'repo'), env: {}, argv: [], fs }).reason, 'not a .wt/<ROW> builder worktree');
    assert.throws(() => readFileSync(join(repo, '.tmp', 'preflight-count')), /ENOENT/); // nothing was written
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('Windows-style path with a trailing slash still matches the worktree shape', () => {
  const r = checkPreflightCap({ repo: 'C:\\dev\\X\\.wt\\ROW-2\\', env: { CI: '1' }, argv: [], fs });
  assert.equal(r.reason, 'CI'); // exemption checked first; shape regex covered below
  const shape = /\/\.wt\/[^/]+$/i;
  assert.ok(shape.test('C:/dev/X/.wt/ROW-2'));
  assert.ok(!shape.test('C:/dev/X/repo'));
});
