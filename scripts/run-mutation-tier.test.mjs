#!/usr/bin/env node
/**
 * run-mutation-tier.test.mjs — control for copySandboxDeps() (SANDBOX-FILELIST-SWEEP-2).
 *
 * WHAT THIS PROVES. Before this row, run-mutation-tier.mjs primed its Stryker scratch sandbox by
 * copying every `chaingraph/kernels/_*.mjs` and `chaingraph/kernels/__proptests__/_*.mjs` file — a
 * filename CONVENTION, not a derivation from what the copied kernel/proptest pair actually imports.
 * It looked derived and was not: a shared helper introduced without the `_` prefix, or a proptest
 * that started importing a non-underscore sibling, would be silently left out of the sandbox and
 * break with an opaque ERR_MODULE_NOT_FOUND deep inside Stryker's command runner — the exact defect
 * class SANDBOX-FILELIST-GATE-1 (PR #1505) already fixed once for check-shard-assembly.test.mjs and
 * check-nav-reachability.test.mjs.
 *
 * R1 below REPRODUCES that near-miss against a throwaway fixture repo (never real kernels — the
 * estate has none today, verified: every proptest that imports a sibling helper imports exactly
 * `./_pbt-common.mjs`) using a standalone copy of the OLD convention-based logic, so the failure
 * mode is demonstrated rather than asserted. R2 proves copySandboxDeps() — the code actually wired
 * into run-mutation-tier.mjs today — gets the same fixture right. R3 proves a genuinely missing
 * dependency still fails, but with ONE NAMED line, never a bare ERR_MODULE_NOT_FOUND (SO #40(b)).
 *
 * Run: node scripts/run-mutation-tier.test.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copySandboxDeps, shortCircuitFixtureOracle, neutralizationTargets, decomposeMoneyMath, decomposedGateDecision } from './run-mutation-tier.mjs';

let passed = 0;
let failed = 0;
const cleanup = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

process.on('exit', () => {
  for (const d of cleanup) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

/**
 * A throwaway repo shaped like chaingraph/kernels/: one kernel, one proptest that imports a
 * SIBLING helper without the `_` prefix — the shape derivation must catch and the old
 * filename-convention copier could not.
 */
function buildFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'rmt-fixture-'));
  cleanup.push(root);
  const kernelsDir = join(root, 'chaingraph', 'kernels');
  const proptestsDir = join(kernelsDir, '__proptests__');
  mkdirSync(kernelsDir, { recursive: true });
  mkdirSync(proptestsDir, { recursive: true });
  writeFileSync(join(kernelsDir, 'fixture-id.kernel.mjs'), "export function buildArtifact() { return 1; }\n");
  // NOT underscore-prefixed — a plain sibling helper, e.g. a second-generation kernel sharing a
  // small utility with its own proptest instead of the estate-wide `_pbt-common.mjs`.
  writeFileSync(join(proptestsDir, 'helper.mjs'), "export const scale = (n) => n * 2;\n");
  writeFileSync(join(proptestsDir, 'fixture-id.proptest.mjs'),
    "import { scale } from './helper.mjs';\nconsole.log(scale(1));\n");
  mkdirSync(join(kernelsDir, 'fixtures'), { recursive: true });
  writeFileSync(join(kernelsDir, 'fixtures', 'fixture-id.fixtures.json'), '{}\n');
  return {
    root,
    kernelRelPath: 'chaingraph/kernels/fixture-id.kernel.mjs',
    proptestRelPath: 'chaingraph/kernels/__proptests__/fixture-id.proptest.mjs',
    fixturesRelPath: 'chaingraph/kernels/fixtures/fixture-id.fixtures.json',
    helperRelPath: 'chaingraph/kernels/__proptests__/helper.mjs',
  };
}

/**
 * The OLD copier: everything starting with `_` in kernels/ and kernels/__proptests__/, plus the
 * kernel/proptest/fixtures themselves. Reproduced here verbatim as a NEGATIVE control — that
 * function no longer exists in run-mutation-tier.mjs, which is the point of this row.
 */
function oldConventionCopy(fx, scratchRoot) {
  const kernelsSrc = join(fx.root, 'chaingraph', 'kernels');
  const proptestsSrc = join(kernelsSrc, '__proptests__');
  const kernelsDest = join(scratchRoot, 'chaingraph', 'kernels');
  const proptestsDest = join(kernelsDest, '__proptests__');
  mkdirSync(proptestsDest, { recursive: true });
  mkdirSync(join(kernelsDest, 'fixtures'), { recursive: true });
  for (const [dir, dest] of [[kernelsSrc, kernelsDest], [proptestsSrc, proptestsDest]]) {
    for (const f of readdirSync(dir)) {
      if (f.startsWith('_') && f.endsWith('.mjs')) cpSync(join(dir, f), join(dest, f));
    }
  }
  cpSync(join(fx.root, fx.kernelRelPath), join(scratchRoot, fx.kernelRelPath));
  cpSync(join(fx.root, fx.proptestRelPath), join(scratchRoot, fx.proptestRelPath));
  cpSync(join(fx.root, fx.fixturesRelPath), join(scratchRoot, fx.fixturesRelPath));
}

console.log('run-mutation-tier controls — sandbox dependency copying');
test('R1 the OLD `_`-prefix convention silently drops a non-underscore sibling (the reproduced near-miss)', () => {
  const fx = buildFixtureRepo();
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-old-'));
  cleanup.push(scratchRoot);
  oldConventionCopy(fx, scratchRoot);
  assert(!existsSync(join(scratchRoot, fx.helperRelPath)),
    'helper.mjs must be MISSING under the old convention — if this ever passes, the near-miss this row fixed no longer reproduces');
  assert(existsSync(join(scratchRoot, fx.proptestRelPath)),
    'the proptest itself must still have been copied — the break is in what it imports, not in itself');
});

test('R2 copySandboxDeps() (the code actually wired in today) copies the same non-underscore sibling correctly', () => {
  const fx = buildFixtureRepo();
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-new-'));
  cleanup.push(scratchRoot);
  const files = copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root);
  assert(existsSync(join(scratchRoot, fx.helperRelPath)),
    `derivation must have found and copied helper.mjs; got files=${JSON.stringify(files)}`);
  assert(files.includes(fx.helperRelPath), `derived file list must name helper.mjs; got ${JSON.stringify(files)}`);
  assert(existsSync(join(scratchRoot, fx.kernelRelPath)) && existsSync(join(scratchRoot, fx.proptestRelPath))
    && existsSync(join(scratchRoot, fx.fixturesRelPath)), 'kernel, proptest and fixtures must all still be copied');
});

test('R3 a genuinely missing dependency fails with ONE NAMED line, never a bare ERR_MODULE_NOT_FOUND', () => {
  const fx = buildFixtureRepo();
  // Delete the helper entirely — nothing on disk can satisfy the import.
  rmSync(join(fx.root, fx.helperRelPath));
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-missing-'));
  cleanup.push(scratchRoot);
  let threw = null;
  try { copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root); }
  catch (e) { threw = e; }
  assert(threw, 'a missing dependency must throw, not silently produce an incomplete sandbox');
  assert(!/ERR_MODULE_NOT_FOUND/.test(threw.message), `must not be a bare ERR_MODULE_NOT_FOUND:\n${threw.message}`);
  assert(/helper\.mjs/.test(threw.message) && /fixture-id\.proptest\.mjs/.test(threw.message),
    `must name BOTH the missing file and its importer:\n${threw.message}`);
});

// ── decomposed scoring controls (MUTATION-DECOMPOSED-SCORE-1) ────────────

console.log('\nrun-mutation-tier controls — decomposed scoring (fixture-leg neutralization, EXP-D shape)');

const LOCAL_ORACLE_SRC = [
  'import { compute } from "../fixture-id.kernel.mjs";',
  'function runFixtureOracle() {',
  '  const failures = checkVectors(compute);',
  '  return failures.length === 0;',
  '}',
  'const oracleOk = runFixtureOracle();',
].join('\n');

const COMMON_ORACLE_SRC = [
  'import { readFileSync } from "node:fs";',
  'export function runFixtureOracle(kernelId, compute, wrapPP = (pp) => pp) {',
  '  const fixtures = JSON.parse(readFileSync(path, "utf8"));',
  '  return { total: fixtures.vectors.length, failures };',
  '}',
].join('\n');

test('R4 the boolean-variant neutralization WRAPS the local runFixtureOracle (body runs verbatim, verdict forced to pass), sync and async', () => {
  for (const decl of ['function runFixtureOracle() {', 'async function runFixtureOracle() {']) {
    const src = LOCAL_ORACLE_SRC.replace('function runFixtureOracle() {', decl);
    const patched = shortCircuitFixtureOracle(src, 'boolean');
    assert(patched !== null, `patcher must find the ${decl} declaration`);
    const hits = patched.split('MUTATION-DECOMPOSED-SCORE-1 fixture-leg neutralization').length - 1;
    assert(hits === 1, `exactly one wrapper insertion expected, got ${hits}`);
    assert(patched.includes('function __mtds1_orig_runFixtureOracle('), 'the original declaration must be RENAMED, not deleted');
    assert(patched.includes('return failures.length === 0;'), 'the original body must survive VERBATIM (side effects the floor summary reads stay intact)');
    assert(patched.includes('function runFixtureOracle(...__mtds1_args)'), 'a wrapper with the ORIGINAL name must be appended');
    assert(patched.includes("if (__mtds1_result && typeof __mtds1_result === 'object') return { ...__mtds1_result, failures: [] };"),
      'an object-shaped result must be neutralized to zero failures (call contract preserved)');
    assert(patched.includes('  return true;'), 'a truthy result must be neutralized to true (oracleOk contract)');
    assert(patched.indexOf('function __mtds1_orig_runFixtureOracle(') < patched.indexOf('function runFixtureOracle(...__mtds1_args)'),
      'the wrapper must come AFTER the renamed original');
    if (decl.startsWith('async')) {
      assert(/async function runFixtureOracle\(\.\.\.__mtds1_args\)/.test(patched), 'an async declaration must get an async wrapper');
      assert(patched.includes('await __mtds1_orig_runFixtureOracle('), 'the async wrapper must await the original');
    } else {
      assert(/[^a-z]function runFixtureOracle\(\.\.\.__mtds1_args\)/.test(patched), 'a sync declaration must get a sync wrapper');
      assert(!patched.includes('await __mtds1_orig_runFixtureOracle('), 'the sync wrapper must not await');
    }
    // The wrapper must be a SIBLING of the renamed original, not nested inside it: the
    // renamed body's closing brace comes before the wrapper declaration.
    const bodyEnd = patched.indexOf('return failures.length === 0;');
    const wrapperStart = patched.indexOf('function runFixtureOracle(...__mtds1_args)');
    assert(bodyEnd !== -1 && wrapperStart > bodyEnd && /\}\s*\n\s*(async\s+)?function runFixtureOracle\(\.\.\.__mtds1_args\)/.test(patched.slice(bodyEnd)),
      'the wrapper must be inserted after the renamed body closes, never inside it');
  }
  assert(shortCircuitFixtureOracle('export const oracle = 1;\n', 'boolean') === null,
    'a floor with no runFixtureOracle declaration must return null (caller raises a NAMED condition), never a guessed patch');
});

test('R5 neutralizationTargets routes the patch: local declaration -> proptest, _pbt-common import -> shared helper, neither -> null', () => {
  const local = neutralizationTargets(LOCAL_ORACLE_SRC);
  assert(local && local.patchProptest === true && local.patchCommon === false, 'a local declaration patches the proptest itself');
  const imported = neutralizationTargets(
    'import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from "./_pbt-common.mjs";\nconst oracle = runFixtureOracle(KERNEL_ID, compute);\n');
  assert(imported && imported.patchProptest === false && imported.patchCommon === true, 'an imported runFixtureOracle patches the _pbt-common.mjs copy');
  assert(neutralizationTargets('import { compute } from "../k.kernel.mjs";\nconsole.log(compute({}));\n') === null,
    'a floor exposing no fixture oracle at all is NAMED (null), never silently scored');
});

test('R6 the OBJECT variant keeps the _pbt-common call contract: { total, failures } always-pass, body preserved', () => {
  const patched = shortCircuitFixtureOracle(COMMON_ORACLE_SRC, 'object');
  assert(patched !== null, 'patcher must find the exported _pbt-common declaration (params containing parens: wrapPP = (pp) => pp)');
  assert(patched.includes('return { total: 0, failures: [] };'), 'the object-variant short-circuit must return the always-pass { total, failures } shape');
  assert(patched.includes('return { total: fixtures.vectors.length, failures };'), 'the original body must survive below the short-circuit');
  assert(patched.includes('wrapPP = (pp) => pp'), 'parameter defaults containing parens must not break the declaration match');
});

test('R7 decomposeMoneyMath reproduces the EXP-D per-mutant diff exactly (fixture/property/run2-only), tier-scoped to money-math', () => {
  const ranges = [[9000, 9100]]; // m6 sits inside the peripheral range and must be excluded from the money-math diff
  const mutant = (id, status, line) => ({ id, status, location: { start: { line } } });
  const reportAsShipped = { files: { 'chaingraph/kernels/fixture-id.kernel.mjs': { mutants: [
    mutant('m1', 'Killed', 10), mutant('m2', 'Killed', 20), mutant('m3', 'Killed', 30),
    mutant('m4', 'Killed', 40), mutant('m5', 'Survived', 50), mutant('m6', 'Killed', 9050),
  ] } } };
  const reportNeutralized = { files: { 'chaingraph/kernels/fixture-id.kernel.mjs': { mutants: [
    mutant('m1', 'Killed', 10), mutant('m2', 'Killed', 20), mutant('m3', 'Killed', 30),
    mutant('m5', 'Survived', 50), mutant('m6', 'Killed', 9050), mutant('m7', 'Killed', 60),
  ] } } };
  const d = decomposeMoneyMath(reportAsShipped, reportNeutralized, 'chaingraph/kernels/fixture-id.kernel.mjs', ranges);
  assert(d.total === 5, `money-math total must exclude peripheral m6 (expected 5, got ${d.total})`);
  assert(d.killedAsShipped === 4, `as-shipped kills (expected 4, got ${d.killedAsShipped})`);
  assert(d.propertyKills === 3, `killed in BOTH runs = property leg (expected 3, got ${d.propertyKills})`);
  assert(d.fixtureKills === 1, `killed as-shipped only = fixture leg (expected 1, got ${d.fixtureKills})`);
  assert(d.run2OnlyKills === 1, `neutralized-only kills must be SURFACED as the anomaly count (expected 1, got ${d.run2OnlyKills})`);
  assert(d.propertyRatio === 60, `propertyRatio over the tier total (expected 60, got ${d.propertyRatio})`);
  assert(d.propertyKills + d.fixtureKills === d.killedAsShipped, 'the two legs must sum to the as-shipped killed count exactly');
});

test('R8 NULL is never PASS (SO #34c): the pre-fix peripheral expression is reproduced as a negative control, and decomposedGateDecision returns a distinct NULL', () => {
  // The pre-fix line verbatim (run-mutation-tier.mjs peripheral pass, pre-row) as a NEGATIVE
  // control — same shape as R1's oldConventionCopy: the bug is demonstrated, not asserted away.
  const oldPeripheralPass = (peScore, floor) => peScore === null || peScore >= floor;
  const newPeripheralPass = (peScore, floor) => peScore !== null && peScore >= floor;
  assert(oldPeripheralPass(null, 70) === true, 'the pre-fix logic must pass a null score (if this ever fails, the reproduced defect no longer reproduces)');
  assert(newPeripheralPass(null, 70) === false, 'the fixed logic must never pass a null score');
  const src = readFileSync(join(import.meta.dirname, 'run-mutation-tier.mjs'), 'utf8');
  assert(src.includes('pe.score !== null && pe.score >= config.peripheralBreakFloor'), 'the fixed peripheral pass expression must be in run-mutation-tier.mjs');
  assert(!src.includes('pe.score === null || pe.score >= config.peripheralBreakFloor'), 'the pre-fix expression must be gone from run-mutation-tier.mjs');

  const cfg40 = { propertyKillsBreakFloor: 40 };
  const fixtureRidden = { total: 100, killedAsShipped: 60, propertyKills: 0, fixtureKills: 60, run2OnlyKills: 0, propertyRatio: 0 };
  const faithful = { total: 30, killedAsShipped: 20, propertyKills: 20, fixtureKills: 0, run2OnlyKills: 0, propertyRatio: 66.7 };
  assert(decomposedGateDecision(fixtureRidden, cfg40) === 'FAIL',
    'BLEND NOT GATED: high fixture kills + zero property kills must FAIL the propertyKills gate even though the blended score would pass');
  assert(decomposedGateDecision(faithful, cfg40) === 'PASS', 'a genuinely property-borne floor must PASS the propertyKills gate');
  assert(decomposedGateDecision({ ...fixtureRidden, error: 'fixture-neutralized stryker run did not run to completion: x' }, cfg40) === 'NULL',
    'a decomposed run that could not complete is the distinct NULL non-pass, never FAIL-as-data nor PASS');
  assert(decomposedGateDecision({ total: 0, killedAsShipped: 0, propertyKills: 0, fixtureKills: 0, run2OnlyKills: 0, propertyRatio: null }, cfg40) === 'NULL',
    'a null propertyRatio is the distinct NULL non-pass, never PASS (SO #34c)');
  assert(decomposedGateDecision(null, cfg40) === 'NULL', 'no decomposed result at all is NULL, never PASS (SO #34c)');
});

console.log(`\nrun-mutation-tier controls: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
