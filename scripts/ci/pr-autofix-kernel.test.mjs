/**
 * scripts/ci/pr-autofix-kernel.test.mjs — allowlist fixtures for the kernel-PR autofix writers.
 * Pure: no writer runs, no tree is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kernelIds, rootPages, allowlists, extraAllowed } from './pr-autofix-kernel.mjs';

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
