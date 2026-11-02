#!/usr/bin/env node
/**
 * scripts/check-ci-relevant.test.mjs — regression proof for
 * CI-RELEVANT-VENDOR-PATHS-1 (2026-11-01).
 *
 * Measured defect: PR #2802 (LANDSCAPE-JCS-DIFF-ORACLE-1) added
 * chaingraph/standard/vendor/canonicalize/{canonicalize.js,LICENSE,PROVENANCE.md}
 * plus a test; no scripts/ci-paths.json glob matched, so BOTH path-filtered
 * jobs (scripts-verify, html-verify) skipped the "Full preflight gate suite"
 * that runs `node scripts/check-credits-coverage.mjs repo`. The PR reported
 * green, merged, and main went red on "Credits registry coverage
 * (vendored-code license gate)" (healed by PR #2803).
 *
 * Fix under test: relevance derives from the credits gate's OWN scan scope via
 * the shared predicate isCreditsGateScopeFile() exported by
 * scripts/check-credits-coverage.mjs (one source of truth, no copied list).
 *
 * Usage: node scripts/check-ci-relevant.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */
import { filesHit } from './check-ci-relevant.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`✗ ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

// ── Fixture 1: PR #2802's EXACT added-file list must hit BOTH keys ──────────
// (LANDSCAPE-JCS-DIFF-ORACLE-1: canonicalize.js + LICENSE + PROVENANCE.md under
// chaingraph/standard/vendor/canonicalize/, plus the accompanying test file.)
const pr2802Files = [
  'chaingraph/standard/vendor/canonicalize/canonicalize.js',
  'chaingraph/standard/vendor/canonicalize/LICENSE',
  'chaingraph/standard/vendor/canonicalize/PROVENANCE.md',
  'chaingraph/standard/vendor/canonicalize/canonicalize.test.mjs',
];
assert(filesHit('scripts-verify', pr2802Files) === true, 'PR #2802 exact file list → scripts-verify hit=true (was the red-main blind spot)');
assert(filesHit('html-verify', pr2802Files) === true, 'PR #2802 exact file list → html-verify hit=true');

// ── Fixture 2: each credits-gate scope shape alone marks BOTH keys ──────────
const scopeCases = [
  ['chaingraph/kernels/vendor/chainlink-protos-cre/sdk.proto', 'vendor/ path segment'],
  ['hub/vendored/ocg/kernels/_proof.mjs', 'vendored/ path segment'],
  ['chaingraph/kernels/_detmath.bundle.mjs', '*.bundle.mjs filename'],
  ['data/credits-registry.json', 'the credits registry itself'],
];
for (const [f, why] of scopeCases) {
  assert(filesHit('scripts-verify', [f]) === true, `credits-gate scope file (${why}) → scripts-verify hit=true`);
  assert(filesHit('html-verify', [f]) === true, `credits-gate scope file (${why}) → html-verify hit=true`);
}

// ── Fixture 3: docs-only control stays irrelevant (no wasted CI minutes) ────
const docsOnly = ['README.md', 'docs/architecture/overview.md', 'guides/quickstart.md'];
assert(filesHit('scripts-verify', docsOnly) === false, 'docs-only change → scripts-verify hit=false (control)');
assert(filesHit('html-verify', docsOnly) === false, 'docs-only change → html-verify hit=false (control)');

// ── Fixture 4: ordinary first-party code not in any glob stays irrelevant ───
assert(filesHit('html-verify', ['tools/_lib/render.mjs']) === false, 'non-HTML first-party module → html-verify hit=false (globs still decide)');

if (failures) {
  console.log(`check-ci-relevant test: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-ci-relevant test: all cases pass');
