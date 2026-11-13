/**
 * scripts/ci/pr-autofix-kernel.test.mjs — allowlist fixtures for the kernel-PR autofix writers.
 * Pure: no writer runs, no tree is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kernelIds, rootPages, allowlists, extraAllowed } from './pr-autofix-kernel.mjs';
import { gitEnv } from '../_git-env-lib.mjs';

const yes = () => true;
const COVERED = ['index.html', 'tools.html', 'sitemap.html', 'sitemap.xml', 'chaingraph', 'tools'];

test('kernel ids come only from existing *.kernel.mjs paths with a valid id', () => {
  const touched = [
    'chaingraph/kernels/art-213-perp.kernel.mjs',
    'chaingraph/kernels/art-213-perp.kernel.mjs',
    'chaingraph/kernels/Bad Id.kernel.mjs',
    'chaingraph/kernels/sub/x.kernel.mjs',
    'chaingraph/kernels/index.mjs',
    'chaingraph/chaingraph.json',
  ];
  assert.deepEqual(kernelIds(touched, yes), ['art-213-perp']);
  assert.deepEqual(kernelIds(touched, () => false), [], 'a deleted kernel names no id');
});

test('identity and schema allowlists are exactly the kernel id own shard and manifest', () => {
  const a = allowlists(['chaingraph/kernels/art-1-x.kernel.mjs'], COVERED, yes);
  assert.deepEqual(a['kernel-identity'], ['chaingraph/graph/nodes/art-1-x.json']);
  assert.deepEqual(a['input-schema'], ['manifests/art-1-x.manifest.json']);
  assert.deepEqual(a['root-chrome'], []);
});

test('no writer allowlist ever contains a shared derived artifact', () => {
  const touched = [
    'chaingraph/kernels/art-1-x.kernel.mjs', 'index.html', 'tools.html', 'sitemap.html',
    'chaingraph/chaingraph.json', 'about.html',
  ];
  const all = extraAllowed(touched, COVERED, yes);
  for (const forbidden of ['index.html', 'tools.html', 'sitemap.html', 'chaingraph/chaingraph.json', 'sitemap.xml']) {
    assert.ok(!all.includes(forbidden), `${forbidden} must not be writable`);
  }
  assert.ok(all.includes('about.html'), 'a touched non-derived root page is writable by root-chrome');
});

test('root pages: only root-level html, nested pages are out', () => {
  assert.deepEqual(rootPages(['a.html', 'tools/b.html', 'c.json', 'd.html']), ['a.html', 'd.html']);
});

test('an untouched root page is never allowed', () => {
  const a = allowlists(['chaingraph/kernels/art-1-x.kernel.mjs'], COVERED, yes);
  assert.ok(!a['root-chrome'].includes('about.html'));
});

// ---- non-applicable writer preconditions skip; real errors still fail ----
import { classifyIdentity, identityStep } from './pr-autofix-kernel.mjs';

const NOT_IN_SCOPE = '✗ art-816-x: not in scope for §17 identity (need status:live, gpu:false, kernel registered in index.mjs, and a .kernel.mjs on disk)';

test('non-live shard: exit 3 with the not-in-scope line is a skip, not a failure', () => {
  assert.equal(classifyIdentity({ status: 3, output: NOT_IN_SCOPE }), 'skip');
  assert.equal(identityStep('art-816-x', () => ({ status: 3, output: NOT_IN_SCOPE }), () => true), 'skip');
});

test('live shard drift: exit 0 is ok (the writer stamped it)', () => {
  const calls = [];
  const run = (a) => { calls.push(a); return { status: 0, output: 'stamped' }; };
  assert.equal(identityStep('art-1-x', run, () => true), 'ok');
  assert.deepEqual(calls[0], ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', '--shard=art-1-x']);
});

test('real writer errors fail: other exit codes and exit 3 without the not-in-scope line', () => {
  assert.equal(classifyIdentity({ status: 4, output: 'SAFETY: stamped shard does not parse' }), 'fail');
  assert.equal(classifyIdentity({ status: 1, output: NOT_IN_SCOPE }), 'fail');
  assert.equal(classifyIdentity({ status: 3, output: 'shard x.json does not parse as JSON' }), 'fail');
  assert.equal(identityStep('art-1-x', () => ({ status: 3, output: 'boom' }), () => true), 'fail');
});

test('missing shard: skipped without running the writer', () => {
  let ran = false;
  assert.equal(identityStep('art-9-x', () => { ran = true; return { status: 0, output: '' }; }, () => false), 'skip');
  assert.equal(ran, false);
});

// ---- whole-PR touched set reaches the identity writer (2026-11-10, #2894) ----
// The job checks out the PR HEAD commit, so the writer's own `git diff HEAD^1 HEAD` probe only sees the
// last commit (after a main merge: main's delta). The script must hand the writer the WHOLE-PR kernel ids.

test('touched ids reach the writer as KERNELID_TOUCHED_IDS (comma list); the args are unchanged', () => {
  const seen = [];
  const run = (a, env) => { seen.push({ a, env }); return { status: 0, output: 'stamped' }; };
  assert.equal(identityStep('art-1-x', run, () => true, ['art-1-x', 'art-2-y']), 'ok');
  assert.deepEqual(seen[0].a, ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', '--shard=art-1-x']);
  assert.deepEqual(seen[0].env, { KERNELID_TOUCHED_IDS: 'art-1-x,art-2-y' });
});

test('no touched list (legacy caller): the writer is run with no env override, exactly as before', () => {
  const seen = [];
  const run = (a, env) => { seen.push({ a, env }); return { status: 0, output: '' }; };
  identityStep('art-1-x', run, () => true);
  assert.equal(seen[0].env, undefined);
});

test('RED/GREEN on the real writer: a main-merge head hides the kernel without the list, the list restores it', async () => {
  // Fixture tree: a shard (live, gpu:false), a kernel file, an index.mjs that does NOT register the node,
  // and a git history whose last commit does not touch the kernel (the main-merge head shape).
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve: res, dirname: dn } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const repo = res(dn(fileURLToPath(import.meta.url)), '..', '..');
  const root = mkdtempSync(join(tmpdir(), 'autofix-touched-'));
  try {
    const kd = join(root, 'chaingraph', 'kernels');
    mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    mkdirSync(kd, { recursive: true });
    for (const f of ['gen-kernel-identity.mjs', '_buildid.mjs']) cpSync(join(repo, 'chaingraph', 'kernels', f), join(kd, f));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    cpSync(join(repo, 'scripts', '_git-env-lib.mjs'), join(root, 'scripts', '_git-env-lib.mjs'));
    // the writer imports nothing else from the estate beyond what the copy above and node builtins give it;
    // if it grows an import this control fails loudly (ERR_MODULE_NOT_FOUND) rather than passing vacuously.
    writeFileSync(join(kd, 'index.mjs'), 'export const KERNELS = {\n};\n');
    writeFileSync(join(kd, 'art-1-x.kernel.mjs'), 'export async function buildArtifact(){ return {}; }\n');
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'art-1-x.json'), JSON.stringify({ tool_id: 'art-1-x', status: 'live', gpu: false }, null, 2) + '\n');
    writeFileSync(join(root, 'chaingraph', 'chaingraph.json'), JSON.stringify({ nodes: [] }) + '\n');
    const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', env: gitEnv() });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    git('add', '-A'); git('commit', '-qm', 'base');
    writeFileSync(join(root, 'unrelated.txt'), 'x'); git('add', '-A'); git('commit', '-qm', 'last commit does not touch the kernel');
    const runWriter = (extra) => spawnSync(process.execPath, [join(kd, 'gen-kernel-identity.mjs'), '--write', '--shard=art-1-x'], {
      cwd: root, encoding: 'utf8', env: gitEnv({ GITHUB_EVENT_NAME: 'pull_request', ...extra }),
    });
    const without = runWriter({});
    assert.equal(without.status, 3, 'RED: without the list the writer must refuse (exit 3): ' + (without.stdout + without.stderr).slice(0, 300));
    assert.ok(/not in scope for \S{0,3}17 identity/.test((without.stdout || '') + (without.stderr || '')), 'RED: refused for the not-in-scope reason, not some other failure');
    const withList = runWriter({ KERNELID_TOUCHED_IDS: 'art-1-x' });
    assert.ok(!/not in scope/.test((withList.stdout || '') + (withList.stderr || '')), 'GREEN: with the list the kernel is in scope: ' + (withList.stdout + withList.stderr).slice(0, 300));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
