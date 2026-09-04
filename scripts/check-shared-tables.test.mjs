/**
 * scripts/check-shared-tables.test.mjs — paired self-test for
 * check-shared-tables.mjs (DUP-TABLE-HASH-GATE-1 / SO #40b pairing).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * SO #40c: a new gate proves RED before GREEN, and SO #34's mutation rider
 * applies — a checker verified only by reading its source, or only by running
 * it against a tree that already passes, proves nothing (it could be
 * `return { divergenceFindings: [] }` and every case here would look
 * identical). Every case below is a MUTATION control against synthetic
 * fixture kernels written to a temp dir: it changes exactly one cell and
 * asserts the verdict moves.
 *
 * Fixtures are written under scripts/.shared-tables-selftest-fixtures/ and
 * removed on exit; nothing under the repo's real kernels is touched or
 * consulted.
 *
 * Run: node scripts/check-shared-tables.test.mjs
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO, run, extractConst, resolvePath } from './check-shared-tables.mjs';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// The extractor resolves kernel file paths against REPO, so fixtures must live inside it.
const FIXROOT = join(REPO, 'scripts', '.shared-tables-selftest-fixtures');
mkdirSync(FIXROOT, { recursive: true });
const workdir = mkdtempSync(join(FIXROOT, 'run-'));
const cleanup = () => { try { rmSync(FIXROOT, { recursive: true, force: true }); } catch { /* best effort */ } };
process.on('exit', cleanup);

function writeKernel(basename, source) {
  const abs = join(workdir, basename);
  writeFileSync(abs, source);
  return relative(REPO, abs).split('\\').join('/');
}

console.log('check-shared-tables.test.mjs');

// ── 1. extractConst reads a module-private const with no export keyword ─────
// Anchors everything below: the real kernels never `export` these tables
// (checked against the live art-218/art-220 source), so if extraction only
// worked on exported consts every later case would be vacuous.
test('EXTRACT - a non-exported const object literal is read via static parse, not import', () => {
  const file = writeKernel('k1.mjs', `
    const NOT_EXPORTED = { 2025: { rate: 5, label: 'five' } };
    export const meta = {};
  `);
  const { value, error } = extractConst(join(REPO, file), 'NOT_EXPORTED');
  assert(error === null, `expected no extraction error, got: ${error}`);
  assert(value[2025].rate === 5, `expected rate 5, got ${JSON.stringify(value)}`);
});

// ── 2. extraction tolerates line comments inside the object body ────────────
test('EXTRACT - line comments inside the literal do not break the parser', () => {
  const file = writeKernel('k2.mjs', `
    const T = {
      2025: { floor: 1345, note: 'a "quoted" phrase' }, // trailing comment
      // full-line comment
      2026: { floor: 1380 },
    };
  `);
  const { value, error } = extractConst(join(REPO, file), 'T');
  assert(error === null, `expected no extraction error, got: ${error}`);
  assert(value[2025].floor === 1345 && value[2026].floor === 1380, `bad extraction: ${JSON.stringify(value)}`);
});

// ── 3. resolvePath substitutes $YEAR and walks dot/bracket paths ────────────
test('RESOLVE - $YEAR substitution plus array-index and dotted paths', () => {
  const obj = { 2025: { tiers: [{ threshold_min: 100 }, { threshold_min: 200 }] } };
  assert(resolvePath(obj, '$YEAR.tiers[0].threshold_min', 2025) === 100, 'index 0 path failed');
  assert(resolvePath(obj, '$YEAR.tiers[1].threshold_min', 2025) === 200, 'index 1 path failed');
});

test('RESOLVE - a missing path resolves to undefined, never throws', () => {
  const obj = { 2025: { floor: 1345 } };
  assert(resolvePath(obj, '$YEAR.does_not_exist', 2025) === undefined, 'expected undefined for a missing key');
});

// ── helper: a minimal two-kernel registry over synthetic fixtures ───────────
function twoKernelRegistry(fileA, fileB, valueA, valueB) {
  const srcA = `const TABLE_A = { 2025: { floor: ${valueA} } }; export const meta = {};`;
  const srcB = `const TABLE_B = { 2025: { floor: ${valueB} } }; export const meta = {};`;
  const relA = writeKernel(fileA, srcA);
  const relB = writeKernel(fileB, srcB);
  return {
    sets: [{
      id: 'TEST-SET',
      years: [2025],
      kernels: [
        { tool_id: 'kernel-a', file: relA, const: 'TABLE_A' },
        { tool_id: 'kernel-b', file: relB, const: 'TABLE_B' },
      ],
      cells: [
        { name: 'floor', paths: { 'kernel-a': '$YEAR.floor', 'kernel-b': '$YEAR.floor' } },
      ],
    }],
  };
}

// ── 4. THE LOAD-BEARING CASE — a synthetic one-cell divergence goes RED ─────
test('MUTATION - a one-cell value divergence across two kernels is reported RED', () => {
  const registry = twoKernelRegistry('div-a.mjs', 'div-b.mjs', '1345', '1380');
  const result = run(registry);
  assert(result.divergenceFindings.length === 1, `expected exactly 1 divergence finding, got ${result.divergenceFindings.length}`);
  const f = result.divergenceFindings[0];
  assert(f.set === 'TEST-SET' && f.cell === 'floor' && f.year === 2025, `wrong finding shape: ${JSON.stringify(f)}`);
  assert(f.values['kernel-a'] === 1345 && f.values['kernel-b'] === 1380, `wrong values captured: ${JSON.stringify(f.values)}`);
});

// ── 5. THE CONTROL — identical cells across two kernels stay GREEN ──────────
// Proves case 4 is not vacuously red on every input.
test('CONTROL - identical cell values across two kernels report zero divergence', () => {
  const registry = twoKernelRegistry('same-a.mjs', 'same-b.mjs', '1345', '1345');
  const result = run(registry);
  assert(result.divergenceFindings.length === 0, `expected zero divergence findings, got ${JSON.stringify(result.divergenceFindings)}`);
  assert(result.checkedSets.includes('TEST-SET'), 'expected TEST-SET to be checked');
});

// ── 6. A cell path that resolves to undefined is a finding, never a silent pass ─
test('MUTATION - an unresolvable cell path is reported, never silently skipped', () => {
  const srcA = `const TABLE_A = { 2025: { floor: 1345 } }; export const meta = {};`;
  const srcB = `const TABLE_B = { 2025: { } }; export const meta = {};`; // missing floor key
  const relA = writeKernel('missing-a.mjs', srcA);
  const relB = writeKernel('missing-b.mjs', srcB);
  const registry = {
    sets: [{
      id: 'MISSING-SET',
      years: [2025],
      kernels: [
        { tool_id: 'kernel-a', file: relA, const: 'TABLE_A' },
        { tool_id: 'kernel-b', file: relB, const: 'TABLE_B' },
      ],
      cells: [{ name: 'floor', paths: { 'kernel-a': '$YEAR.floor', 'kernel-b': '$YEAR.floor' } }],
    }],
  };
  const result = run(registry);
  assert(result.unresolvedFindings.length === 1, `expected 1 unresolved finding, got ${result.unresolvedFindings.length}`);
  assert(result.divergenceFindings.length === 0, 'an unresolved cell must not also be scored as a divergence');
});

// ── 7. EXEMPT-BY-DESIGN sets are recorded but never compared ────────────────
test('EXEMPT - a status:EXEMPT-BY-DESIGN set is recorded, not extracted or compared', () => {
  const registry = {
    sets: [{
      id: 'EXEMPT-SET',
      status: 'EXEMPT-BY-DESIGN',
      exemptReason: 'no second copy exists',
      kernels: [{ tool_id: 'kernel-a', file: 'does/not/exist.mjs', const: 'NOPE' }],
      cells: [],
    }],
  };
  const result = run(registry);
  assert(result.exemptSets.length === 1 && result.exemptSets[0].id === 'EXEMPT-SET', 'exempt set not recorded');
  assert(result.extractionErrors.length === 0, 'an exempt set must never attempt extraction (file does not exist, would error if touched)');
  assert(result.checkedSets.length === 0, 'an exempt set must not appear in checkedSets');
});

// ── 8. A missing const / bad file is an EXTRACTION ERROR, never a silent pass ─
test('MUTATION - a const that does not exist in the file is an extraction error, not a pass', () => {
  const rel = writeKernel('no-const.mjs', `const OTHER_NAME = { 2025: { floor: 1 } };`);
  const registry = {
    sets: [{
      id: 'BAD-CONST-SET',
      years: [2025],
      kernels: [{ tool_id: 'kernel-a', file: rel, const: 'DOES_NOT_EXIST' }],
      cells: [{ name: 'floor', paths: { 'kernel-a': '$YEAR.floor' } }],
    }],
  };
  const result = run(registry);
  assert(result.extractionErrors.length === 1, `expected 1 extraction error, got ${result.extractionErrors.length}`);
  assert(result.checkedSets.length === 0, 'a set with an extraction error must not be scored as checked');
});

console.log(`\ncheck-shared-tables.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
