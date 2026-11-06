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
