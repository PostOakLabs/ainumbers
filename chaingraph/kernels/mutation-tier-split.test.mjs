#!/usr/bin/env node
// mutation-tier-split.test.mjs — proven-to-reject fixture for MUTATION-TIERED-ROLLOUT-1's
// classifier. Positive AND negative controls per SO #34 ("verify a checker by mutation,
// not by reading it") — every assertion below is paired with a case that PROVES the
// classifier would have gotten it wrong under a naive design.
//
// TWO REAL KERNEL SHAPES ARE FIXTURED, because a first version of this classifier
// (cut money-math as "everything before the buildArtifact() line") was proven wrong by
// running it for real against art-431-fdic-assessment-rate-calculator.kernel.mjs: that
// kernel declares `export const meta` (and its TOOL_ID/TOOL_VERSION consts) BEFORE
// compute(), not after — the before-buildArtifact cut miscounted meta's unkillable
// literal mutants as money-math. art-06-genius-act-reserve-attestation.kernel.mjs
// declares meta AFTER buildArtifact instead. Both orderings are fixtured below so a
// future regression on either one fails loudly here before it ever reaches a live run.

import {
  scanBalanced, classifyKernelSource, tierOfLine, tierOfMutant, isSharedLibPath, scoreOf, tierReport,
} from './mutation-tier-split.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Fixture A — MODELLED ON art-431: TOOL_ID/TOOL_VERSION + meta (multi-line) declared
// BEFORE module-scope helpers and compute(); buildArtifact AFTER compute(), with a
// destructuring-default parameter (`{ now, ... } = {}`) — the shape that breaks a naive
// paren/brace scan that doesn't bracket-stack properly.
const FIXTURE_A = [
  /* 1*/ "import { executionHash } from './_hash.mjs';",
  /* 2*/ '',
  /* 3*/ "const TOOL_ID = 'fx-01';",
  /* 4*/ "const TOOL_VERSION = '1.0.0';",
  /* 5*/ '',
  /* 6*/ 'export const meta = {',
  /* 7*/ '  tool_id: TOOL_ID, tool_version: TOOL_VERSION,',
  /* 8*/ "  mcp_name: 'compute_fx', gpu: false,",
  /* 9*/ '};',
  /*10*/ '',
  /*11*/ 'function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }', // money-math helper, ABOVE compute()
  /*12*/ '',
  /*13*/ 'export function compute(pp) {',
  /*14*/ '  return { output: clamp(pp.x, 0, 100) };',
  /*15*/ '}',
  /*16*/ '',
  /*17*/ 'export async function buildArtifact(pp, { now, parent_hashes = [], chain_depth = 0 } = {}) {',
  /*18*/ "  return { compute_mode: 'chained', audit_signature: {} };",
  /*19*/ '}',
  '',
].join('\n');

// Fixture B — MODELLED ON art-06: meta declared AFTER buildArtifact, single-line.
const FIXTURE_B = [
  /* 1*/ "const TOOL_ID = 'fx-02';",
  /* 2*/ "const TOOL_VERSION = '1.0.0';",
  /* 3*/ '',
  /* 4*/ 'function r2(v) { return Math.round(v * 100) / 100; }', // money-math helper, ABOVE compute()
  /* 5*/ '',
  /* 6*/ 'export function compute(pp) {',
  /* 7*/ '  return { output: r2(pp.x) };',
  /* 8*/ '}',
  /* 9*/ '',
  /*10*/ 'export async function buildArtifact(pp, opts = {}) {',
  /*11*/ "  return { compute_mode: 'chained' };",
  /*12*/ '}',
  /*13*/ '',
  /*14*/ "export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false };",
  '',
].join('\n');

const NON_CANONICAL_SOURCE = [
  'function compute(pp) { return { output: pp.x }; }',
  'function meta() { return {}; }',
  'export { compute, meta };',
  '',
].join('\n');

test('scanBalanced finds the matching close bracket across nested types, skipping string contents', () => {
  const s = "foo({ a: '}', b: [1,2,{c:3}] }, 'x)y') ";
  const openIdx = s.indexOf('(');
  const closeIdx = scanBalanced(s, openIdx);
  assert(s[closeIdx] === ')', `expected the matching ')' , got '${s[closeIdx]}' at ${closeIdx}`);
  assert(closeIdx === s.indexOf(") "), 'must match the OUTER close paren, not a paren-like char inside the string literal');
});

test('scanBalanced returns -1 on unbalanced input rather than guessing', () => {
  assert(scanBalanced('{ a: 1, b: [2, 3]', 0) === -1, 'truncated/unbalanced input must report -1');
});

test('OBSERVED RED (regression fixture) — a line comment containing an apostrophe (real measured case: art-332/art-413) must not desync the scan', () => {
  const s = [
    'function f() {',
    "  // reusing art-350's convention here, never a hand-rolled one",
    "  return { x: 'ok' };",
    '}',
  ].join('\n');
  const openIdx = s.indexOf('{');
  const closeIdx = scanBalanced(s, openIdx);
  assert(closeIdx === s.lastIndexOf('}'), `expected the outer function body's own closing brace (index ${s.lastIndexOf('}')}), got ${closeIdx}`);
});

test('scanBalanced skips a block comment containing bracket-like characters', () => {
  const s = "{ a: 1 /* not a { real } brace */, b: 2 }";
  const closeIdx = scanBalanced(s, 0);
  assert(closeIdx === s.length - 1, `expected the final '}' at index ${s.length - 1}, got ${closeIdx}`);
});

test('OBSERVED RED (regression fixture) — Fixture A (meta BEFORE compute, art-431 shape) is recognised canonical and meta+TOOL_ID+TOOL_VERSION are all EXCLUDED from money-math', () => {
  const { hasCanonicalShape, peripheralRanges } = classifyKernelSource(FIXTURE_A);
  assert(hasCanonicalShape === true, 'Fixture A must be recognised as canonical-shape');
  // A naive "before buildArtifact() line" cut would have called lines 3,4,6-9 money-math (WRONG).
  for (const line of [3, 4, 6, 7, 8, 9]) {
    assert(tierOfLine(line, peripheralRanges) === 'peripheral', `line ${line} (TOOL_ID/TOOL_VERSION/meta) must classify peripheral, got ${tierOfLine(line, peripheralRanges)}`);
  }
});

test('Fixture A — compute() and its ABOVE-declared helper are money-math; buildArtifact (with a destructuring-default param) is peripheral', () => {
  const { peripheralRanges } = classifyKernelSource(FIXTURE_A);
  for (const line of [11, 13, 14, 15]) {
    assert(tierOfLine(line, peripheralRanges) === 'moneyMath', `line ${line} (clamp()/compute()) expected moneyMath`);
  }
  for (const line of [17, 18, 19]) {
    assert(tierOfLine(line, peripheralRanges) === 'peripheral', `line ${line} (buildArtifact) expected peripheral`);
  }
});

test('Fixture B (meta AFTER buildArtifact, single-line, art-06 shape) — compute()+helper money-math, buildArtifact+meta+TOOL_ID/VERSION peripheral', () => {
  const { hasCanonicalShape, peripheralRanges } = classifyKernelSource(FIXTURE_B);
  assert(hasCanonicalShape === true, 'Fixture B must be recognised as canonical-shape');
  for (const line of [4, 6, 7, 8]) {
    assert(tierOfLine(line, peripheralRanges) === 'moneyMath', `line ${line} (r2()/compute()) expected moneyMath`);
  }
  for (const line of [1, 2, 10, 11, 12, 14]) {
    assert(tierOfLine(line, peripheralRanges) === 'peripheral', `line ${line} (TOOL_ID/TOOL_VERSION/buildArtifact/meta) expected peripheral`);
  }
});

test('OBSERVED RED — a non-canonical kernel (export { compute, meta } shape, e.g. art-594) is NOT silently split; hasCanonicalShape is false and peripheralRanges is empty', () => {
  const r = classifyKernelSource(NON_CANONICAL_SOURCE);
  assert(r.hasCanonicalShape === false, 'non-canonical fixture must NOT be reported as canonical');
  assert(Array.isArray(r.peripheralRanges) && r.peripheralRanges.length === 0, 'non-canonical fixture must report no ranges, never a guessed one');
});

test('isSharedLibPath recognises chaingraph/kernels/_*.mjs helpers on both slash styles, and rejects a kernel file', () => {
  assert(isSharedLibPath('chaingraph/kernels/_hash.mjs') === true, 'forward-slash shared lib path');
  assert(isSharedLibPath('chaingraph\\kernels\\_detmath.bundle.mjs') === true, 'back-slash shared lib path');
  assert(isSharedLibPath('chaingraph/kernels/art-431-fdic-assessment-rate-calculator.kernel.mjs') === false, 'a kernel file itself must NOT classify as a shared lib');
});

test('tierOfMutant — shared-lib mutants are ALWAYS money-math regardless of line number', () => {
  const { peripheralRanges } = classifyKernelSource(FIXTURE_A);
  const mutant = { location: { start: { line: 9999 } } }; // deliberately absurd line — must not matter
  const tier = tierOfMutant(mutant, 'chaingraph/kernels/_hash.mjs', 'chaingraph/kernels/fx-01.kernel.mjs', peripheralRanges);
  assert(tier === 'moneyMath', `expected moneyMath for a shared-lib mutant regardless of line, got ${tier}`);
});

test('tierOfMutant — a mutant with no parseable location classifies "other", never silently dropped into a tier', () => {
  const { peripheralRanges } = classifyKernelSource(FIXTURE_A);
  const mutant = { location: {} };
  const tier = tierOfMutant(mutant, 'chaingraph/kernels/fx-01.kernel.mjs', 'chaingraph/kernels/fx-01.kernel.mjs', peripheralRanges);
  assert(tier === 'other', `expected other for an unlocatable mutant, got ${tier}`);
});

test('scoreOf — Killed/Survived/Timeout/NoCoverage all counted; score = killed/total (pilot-identical formula)', () => {
  const s = scoreOf([{ status: 'Killed' }, { status: 'Killed' }, { status: 'Survived' }, { status: 'Timeout' }, { status: 'NoCoverage' }]);
  assert(s.total === 5, `expected total 5, got ${s.total}`);
  assert(s.killed === 2 && s.survived === 1 && s.timeout === 1 && s.noCoverage === 1, `unexpected bucket counts: ${JSON.stringify(s)}`);
  assert(s.score === 40.0, `expected score 40.0 (2/5), got ${s.score}`);
});

test('scoreOf — an empty mutant set reports null score, never a false 100% or 0%', () => {
  const s = scoreOf([]);
  assert(s.total === 0 && s.score === null, `expected total 0 / score null for an empty set, got ${JSON.stringify(s)}`);
});

test('tierReport — a full report is correctly bucketed and scored per tier from a realistic Stryker JSON shape (Fixture A)', () => {
  const { peripheralRanges } = classifyKernelSource(FIXTURE_A);
  const kernelFile = 'chaingraph/kernels/fx-01.kernel.mjs';
  const report = {
    files: {
      [kernelFile]: {
        mutants: [
          { status: 'Killed', location: { start: { line: 11 } } },   // moneyMath (clamp helper)
          { status: 'Survived', location: { start: { line: 14 } } }, // moneyMath (inside compute())
          { status: 'Killed', location: { start: { line: 18 } } },   // peripheral (buildArtifact body)
          { status: 'Survived', location: { start: { line: 6 } } },  // peripheral (meta)
        ],
      },
      'chaingraph/kernels/_hash.mjs': {
        mutants: [{ status: 'Killed', location: { start: { line: 1 } } }], // moneyMath (shared lib)
      },
    },
  };
  const r = tierReport(report, kernelFile, peripheralRanges);
  assert(r.moneyMath.total === 3, `expected 3 money-math mutants (2 kernel + 1 shared-lib), got ${r.moneyMath.total}`);
  assert(r.moneyMath.killed === 2, `expected 2 money-math kills, got ${r.moneyMath.killed}`);
  assert(r.peripheral.total === 2, `expected 2 peripheral mutants, got ${r.peripheral.total}`);
  assert(r.peripheral.killed === 1, `expected 1 peripheral kill, got ${r.peripheral.killed}`);
  assert(r.other.total === 0, `expected 0 "other" (unclassifiable) mutants for a well-formed report, got ${r.other.total}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
// A thrown error, not process.exit(1) — this file lives OUTSIDE
// chaingraph/kernels/__proptests__/, which is the only directory
// jsdoc-checkjs-gate.mjs allowlists for the no-@types/node `process`/`node:*`
// gap (see that gate's own header, rule 2). An uncaught throw exits Node 1
// exactly like process.exit(1) would, without touching the `process` global
// at all — no TS2580 for a script this small to justify a wider allowlist over.
if (failed > 0) throw new Error(`${failed} test(s) failed`);
