#!/usr/bin/env node
/**
 * scripts/check-gate-selftest-pairing.test.mjs — fixture proof for
 * GATE-SELFTEST-META-1 (check-gate-selftest-pairing.mjs's own pair).
 *
 * Never touches the real scripts/preflight.mjs or the real filesystem beyond
 * this process's own module graph — every fixture is an in-memory command
 * list plus an injected `exists` function, so this stays valid regardless of
 * what preflight.mjs's real GATES array looks like on any given day.
 *
 * Covers, in order:
 *   1. extractInvokedCommands: pulls quoted node/python commands out of a
 *      synthetic GATES array literal, and — the mutation control — a
 *      commented-out row does NOT count (same guarantee
 *      check-generator-coverage.mjs relies on for its own extraction).
 *   2. isCheckerCandidate: the check-X.mjs naming scope, positive and
 *      negative (test/selftest siblings and non-`check-` scripts excluded).
 *   3. classify(): the RED -> GREEN proof named in the row's rail 4 —
 *      a scratch blocking gate with no pair is flagged unpaired (RED); the
 *      same fixture with a pair added (sibling .test.mjs, sibling
 *      .selftest.mjs, or an inline --self-test GATES entry) is not (GREEN).
 *
 * Usage: node scripts/check-gate-selftest-pairing.test.mjs
 * Exit 0 = every assertion passed. Exit 1 = a fixture assertion failed.
 */
import { extractInvokedCommands, pathOf, isCheckerCandidate, pairPathsFor, classify } from './check-gate-selftest-pairing.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}

// ── 1. extractInvokedCommands ────────────────────────────────────────────
const fakePreflightSrc = `
const GATES = [
  ['Live gate A', 'node scripts/check-live-a.mjs'],
  // ['Commented-out gate', 'node scripts/check-should-not-appear.mjs'],
  ['Live gate B', 'python scripts/check-live-b.py'],
  ['Live gate C (flag)', 'node scripts/check-live-a.mjs --self-test'],
];
`;
const extracted = extractInvokedCommands(fakePreflightSrc);
assert(extracted.includes('node scripts/check-live-a.mjs'), 'extractInvokedCommands finds a live GATES command');
assert(extracted.includes('python scripts/check-live-b.py'), 'extractInvokedCommands finds a live python GATES command');
assert(extracted.includes('node scripts/check-live-a.mjs --self-test'), 'extractInvokedCommands finds a live --self-test GATES command');
assert(!extracted.some((c) => c.includes('check-should-not-appear')), 'extractInvokedCommands MUTATION CONTROL: a commented-out GATES row is not extracted');
assert(pathOf('node scripts/check-live-a.mjs --self-test') === 'scripts/check-live-a.mjs', 'pathOf takes the script path, not the flag');

// ── 2. isCheckerCandidate ────────────────────────────────────────────────
assert(isCheckerCandidate('scripts/check-live-a.mjs'), 'isCheckerCandidate: a check-X.mjs script is a candidate');
assert(isCheckerCandidate('chaingraph/kernels/check-guest-builtin-safety.mjs'), 'isCheckerCandidate: matches regardless of directory depth');
assert(!isCheckerCandidate('scripts/check-live-a.test.mjs'), 'isCheckerCandidate: a .test.mjs sibling is itself a pair, not a candidate');
assert(!isCheckerCandidate('scripts/check-live-a.selftest.mjs'), 'isCheckerCandidate: a .selftest.mjs sibling is itself a pair, not a candidate');
assert(!isCheckerCandidate('scripts/verify-counts.mjs'), 'isCheckerCandidate: out-of-naming-scope script (no check- prefix) is not a candidate, by design');
assert(!isCheckerCandidate('scripts/check_tools.js'), 'isCheckerCandidate: a .js (not .mjs) file is out of scope, by design');
assert(!isCheckerCandidate(null), 'isCheckerCandidate: null path is handled without throwing');

// ── 3. classify() — THE RED -> GREEN PROOF (row rail 4) ──────────────────
const noFilesExist = () => false;

// RED: a scratch blocking gate with no pair at all.
const redCommands = ['node scripts/check-scratch-fixture.mjs'];
const red = classify(redCommands, noFilesExist);
assert(red.candidates.includes('scripts/check-scratch-fixture.mjs'), 'RED fixture: the scratch gate is picked up as a candidate');
assert(red.unpaired.includes('scripts/check-scratch-fixture.mjs'), 'RED: scratch blocking gate with NO pair is flagged unpaired');
assert(!red.paired.includes('scripts/check-scratch-fixture.mjs'), 'RED: scratch blocking gate with no pair is not counted paired');
console.log(`  [quotable] RED  — classify(${JSON.stringify(redCommands)}) => unpaired: ${JSON.stringify(red.unpaired)}`);

// GREEN, form (a): sibling check-scratch-fixture.test.mjs, wired AND on disk.
const greenSiblingCommands = [
  'node scripts/check-scratch-fixture.mjs',
  'node scripts/check-scratch-fixture.test.mjs',
];
const greenSibling = classify(greenSiblingCommands, (p) => p === 'scripts/check-scratch-fixture.test.mjs');
assert(greenSibling.paired.includes('scripts/check-scratch-fixture.mjs'), 'GREEN (sibling .test.mjs, wired + on disk): scratch gate now paired');
assert(!greenSibling.unpaired.includes('scripts/check-scratch-fixture.mjs'), 'GREEN (sibling .test.mjs): no longer unpaired');
console.log(`  [quotable] GREEN — classify(${JSON.stringify(greenSiblingCommands)}) => paired: ${JSON.stringify(greenSibling.paired)}`);

// Negative control on form (a): sibling file wired into GATES but MISSING on disk
// must NOT count as paired (a phantom command with no real file proves nothing).
const phantomPair = classify(greenSiblingCommands, noFilesExist);
assert(phantomPair.unpaired.includes('scripts/check-scratch-fixture.mjs'), 'MUTATION CONTROL: sibling .test.mjs wired but absent from disk does NOT count as paired');

// Negative control on form (a): file exists on disk but is NEVER wired into
// GATES (would run nothing, prove nothing) must NOT count as paired.
const unwiredPair = classify(['node scripts/check-scratch-fixture.mjs'], (p) => p === 'scripts/check-scratch-fixture.test.mjs');
assert(unwiredPair.unpaired.includes('scripts/check-scratch-fixture.mjs'), 'MUTATION CONTROL: sibling .test.mjs on disk but not a GATES entry does NOT count as paired');

// GREEN, form (a-variant): sibling check-scratch-fixture.selftest.mjs.
const greenSelftest = classify(
  ['node scripts/check-scratch-fixture.mjs', 'node scripts/check-scratch-fixture.selftest.mjs'],
  (p) => p === 'scripts/check-scratch-fixture.selftest.mjs',
);
assert(greenSelftest.paired.includes('scripts/check-scratch-fixture.mjs'), 'GREEN (sibling .selftest.mjs, wired + on disk): scratch gate now paired');

// GREEN, form (b): the SAME script invoked with --self-test as its own GATES entry (no separate file needed).
const greenInline = classify(
  ['node scripts/check-scratch-fixture.mjs --check', 'node scripts/check-scratch-fixture.mjs --self-test'],
  noFilesExist,
);
assert(greenInline.paired.includes('scripts/check-scratch-fixture.mjs'), 'GREEN (inline --self-test GATES entry): scratch gate now paired, no separate file needed');
console.log(`  [quotable] GREEN — classify(['...--check', '...--self-test']) => paired: ${JSON.stringify(greenInline.paired)}`);

// pairPathsFor sanity.
const pp = pairPathsFor('scripts/check-scratch-fixture.mjs');
assert(pp.testFile === 'scripts/check-scratch-fixture.test.mjs' && pp.selftestFile === 'scripts/check-scratch-fixture.selftest.mjs', 'pairPathsFor derives both recognized sibling forms');

if (failures) {
  console.error(`\n✗ check-gate-selftest-pairing.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ check-gate-selftest-pairing.test.mjs: all fixture assertions passed (RED and GREEN both proven).');
