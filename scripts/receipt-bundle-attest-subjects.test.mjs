// receipt-bundle-attest-subjects.test.mjs — SIGSTORE-BUNDLE-V03-EXPORT-4 selftest.
//
// 1. The derived subject-path glob covers every published bundle named in the
//    PUBLISHED index.json at repo root (never the §5 fixtures), and the count
//    matches the index's own count field.
// 2. A synthetic index whose bundle name escapes the receipt-bundles directory
//    is rejected (exit path, errors reported).
// 3. The main() CLI prints the subject-path form and exits 0 on the published
//    index, exits 1 on a malformed one.
//
// Run: node --test scripts/receipt-bundle-attest-subjects.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { subjectPathsForIndex, subjectPathForBundle, SUBJECT_GLOB, main } from './receipt-bundle-attest-subjects.mjs';

const publishedIndexPath = join('chaingraph', 'receipt-bundles', 'index.json');

test('published index: glob covers every bundle, count matches', () => {
  const index = JSON.parse(readFileSync(publishedIndexPath, 'utf8'));
  const { subjectPath, files, errors } = subjectPathsForIndex(index);
  assert.deepEqual(errors, []);
  assert.equal(subjectPath, SUBJECT_GLOB);
  assert.equal(files.length, index.bundles.length);
  if (typeof index.count === 'number') assert.equal(files.length, index.count);
  for (const f of files) {
    assert.match(f, /^chaingraph\/receipt-bundles\/[^/]+\.bundle\.json$/);
    assert.ok(!f.includes('fixtures'), 'fixtures must never be attested');
  }
});

test('bare index names are joined to the receipt-bundles directory', () => {
  assert.equal(subjectPathForBundle('a.bundle.json'), 'chaingraph/receipt-bundles/a.bundle.json');
  assert.equal(subjectPathForBundle('x/a.bundle.json'), 'x/a.bundle.json');
});

test('synthetic index with an uncovered bundle name is rejected', () => {
  const bad = {
    bundles: [
      { tool_id: 'a', bundle: 'chaingraph/receipt-bundles/a.bundle.json' },
      { tool_id: 'b', bundle: 'elsewhere/b.bundle.json' },
      { tool_id: 'c', bundle: null },
    ],
  };
  const { errors } = subjectPathsForIndex(bad);
  assert.equal(errors.length, 2);
});

test('empty or malformed index is rejected', () => {
  assert.ok(subjectPathsForIndex({}).errors.length > 0);
  assert.ok(subjectPathsForIndex(null).errors.length > 0);
});

test('CLI: exit 0 and glob on the published index, exit 1 on a bad one', () => {
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (m) => lines.push(m);
  console.error = () => {};
  try {
    assert.equal(main([publishedIndexPath]), 0);
    assert.ok(lines.includes(SUBJECT_GLOB));
    const dir = mkdtempSync(join(tmpdir(), 'attest-subjects-'));
    try {
      const badPath = join(dir, 'index.json');
      writeFileSync(badPath, JSON.stringify({ bundles: [{ tool_id: 'x', bundle: 'nope.json' }] }));
      assert.equal(main([badPath]), 1);
      mkdirSync(dir, { recursive: true });
      assert.equal(main([join(dir, 'missing.json')]), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
});
