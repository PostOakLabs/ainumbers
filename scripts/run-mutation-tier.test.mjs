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

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, cpSync, rmSync, readFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath as fileURLToPathLocal } from 'node:url';
import { copySandboxDeps, shortCircuitFixtureOracle, neutralizationTargets, decomposeMoneyMath, decomposedGateDecision, kernelTimeoutSecondsFromEnv, kernelTimeoutSecondsForKernel, mutationTrialsForKernel, mutationEnvForKernel, runProcessBounded, resolveStrykerInvocation, findDetmathMarkerRange, surfaceSplitPatch, resolveSurfaceSplit, survivorLocations, assertSurvivorsComplete, buildJsonResult, artifactConstRanges, tierOfMutantWithArtifact, tierReportWithArtifact, loadConfig } from './run-mutation-tier.mjs';
import { mergeMutationSiblings, loadOriginalAuthorshipAllowlist } from './lib-per-kernel-config.mjs';
import { classifyKernelSource, tierReport } from '../chaingraph/kernels/mutation-tier-split.mjs';

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

// ── per-kernel wall-clock bound controls (MUTATION-TIER-HANG-MMS03-PNR01-1) ──

console.log('\nrun-mutation-tier controls — per-kernel wall-clock bound (MUTATION-TIER-HANG-MMS03-PNR01-1)');

test('R9 kernelTimeoutSecondsFromEnv: default 600, integer override honored, anything else is a LOUD config error (never a silently unbounded run)', () => {
  assert(kernelTimeoutSecondsFromEnv({}) === 600, 'no env var must default to 600s (10 min)');
  assert(kernelTimeoutSecondsFromEnv({ MUTATION_TIER_KERNEL_TIMEOUT_S: '' }) === 600, 'an empty env var must default to 600s');
  assert(kernelTimeoutSecondsFromEnv({ MUTATION_TIER_KERNEL_TIMEOUT_S: '90' }) === 90, 'a positive integer override must be honored');
  // '1e3' is ACCEPTED (Number('1e3') === 1000, a positive integer — a bound is a
  // bound); anything that does not parse to a positive integer is rejected loudly.
  for (const bad of ['0', '-5', '3.5', 'abc', '600s', ' ']) {
    let threw = null;
    try { kernelTimeoutSecondsFromEnv({ MUTATION_TIER_KERNEL_TIMEOUT_S: bad }); } catch (e) { threw = e; }
    assert(threw, `"${bad}" must be rejected, never silently accepted (a typo must not remove the bound)`);
    assert(/MUTATION_TIER_KERNEL_TIMEOUT_S/.test(threw.message), `the rejection must name the env var: ${threw.message}`);
  }
});

test('R9b resolveStrykerInvocation (MUTATION-TIER-LOCAL-STRYKER-1): env unset = npx argv unchanged; env set + file exists = node <bin> run; env set + missing = npx fallback with warning', () => {
  const base = { platform: 'linux', strykerVersion: '8.7.1', configPath: '/c/stryker.conf.json' };
  const npxArgs = ['--yes', '--package=@stryker-mutator/core@8.7.1', 'stryker', 'run', '/c/stryker.conf.json'];
  const unset = resolveStrykerInvocation({ ...base, env: {}, fileExists: () => true });
  assert(unset.mode === 'npx' && unset.cmd === 'npx' && unset.warning === null, 'unset env must take the npx path with no warning');
  assert(JSON.stringify(unset.args) === JSON.stringify(npxArgs), `unset env must keep the npx args byte-identical: ${unset.args}`);
  const empty = resolveStrykerInvocation({ ...base, env: { MUTATION_TIER_STRYKER_BIN: '' }, fileExists: () => true });
  assert(empty.mode === 'npx' && JSON.stringify(empty.args) === JSON.stringify(npxArgs), 'empty env must behave as unset');
  const local = resolveStrykerInvocation({ ...base, env: { MUTATION_TIER_STRYKER_BIN: '/x/stryker.js' }, fileExists: (p) => p === '/x/stryker.js' });
  assert(local.mode === 'local-bin' && local.cmd === process.execPath, 'existing file must spawn process.execPath');
  assert(JSON.stringify(local.args) === JSON.stringify(['/x/stryker.js', 'run', '/c/stryker.conf.json']), `local args wrong: ${local.args}`);
  const missing = resolveStrykerInvocation({ ...base, env: { MUTATION_TIER_STRYKER_BIN: '/nope.js' }, fileExists: () => false });
  assert(missing.mode === 'npx' && JSON.stringify(missing.args) === JSON.stringify(npxArgs), 'missing file must fall back to the npx argv');
  assert(/MUTATION_TIER_STRYKER_BIN/.test(missing.warning || ''), 'missing file must warn, naming the env var');
});

// R10 spawns a real child, so the sync harness above cannot drive it — awaited
// explicitly before the summary (top-level await, .mjs).
async function asyncTest(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

await asyncTest('R10 runProcessBounded kills a sleep-forever child within its budget — timedOut reported, kill confirmed, NO residual process', async () => {
  const pidFile = join(tmpdir(), `rmt-sleeper-pid-${process.pid}-${Date.now()}.txt`);
  cleanup.push(pidFile);
  // The fixture "test that sleeps forever": writes its pid, then never exits —
  // the same shape as a mutant-trapped unbounded MC loop in a kernel floor.
  const sleeperSrc = `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => 0, 1000);`;
  const t0 = Date.now();
  const run = await runProcessBounded({ cmd: process.execPath, args: ['-e', sleeperSrc], cwd: tmpdir(), budgetS: 2 });
  assert(run.timedOut === true, 'a run past its budget must be reported as timedOut');
  assert(run.crashed === false, 'a budget kill is NOT a spawn crash (crashed stays reserved for spawn-level failure)');
  assert(run.killConfirmed === true, 'the tree kill must be confirmed by the child closing before the grace expires');
  assert(run.elapsedS >= 2, `the budget must actually bound the run from below (elapsed ${run.elapsedS}s)`);
  assert(run.elapsedS <= 20 && (Date.now() - t0) <= 20000, `a 2s budget must not turn into a long wait (elapsed ${run.elapsedS}s, wall ${Date.now() - t0}ms)`);
  // No residual: the sleeper must actually be DEAD once the bounded run returns.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const sleeperPid = Number(readFileSync(pidFile, 'utf8').trim());
  let alive = true;
  try { process.kill(sleeperPid, 0); } catch { alive = false; }
  assert(!alive, `the sleeping child (pid ${sleeperPid}) must be dead after the bounded run — a residual process was left behind`);
  try { unlinkSync(pidFile); } catch { /* already removed via cleanup */ }
});

// ── per-kernel bound resolution (MUTATION-TIER-CONFIG-BOUND-1) ───────────
// The bound is now CONFIG-DECLARED (SO #41) and resolved PER KERNEL as:
// env MUTATION_TIER_KERNEL_TIMEOUT_S (global override, unchanged semantics) >
// mutation-tiers.config.json kernelTimeoutSeconds[id] (positive integer or
// LOUD failure) > default 600 s (unchanged). R9 above still pins the env-only
// function's own contract; the legs below pin the three-level resolution.

console.log('\nrun-mutation-tier controls — per-kernel bound resolution (MUTATION-TIER-CONFIG-BOUND-1)');

const PNR01 = 'pnr-01-dora-ict-cascade-simulator';

test('R11 config per-kernel bound applies per kernel (config 9000, env unset -> 9000, NOT the 600 default)', () => {
  const config = { kernelTimeoutSeconds: { [PNR01]: 9000, 'mms-03-standin-for-leg': 4321 } };
  assert(kernelTimeoutSecondsForKernel(PNR01, {}, config) === 9000,
    'config kernelTimeoutSeconds["' + PNR01 + '"]=9000 with env unset must resolve 9000 — if this returns 600, the config section is being ignored');
  assert(kernelTimeoutSecondsForKernel('mms-03-standin-for-leg', {}, config) === 4321,
    'a second kernel named in the same config must resolve ITS OWN value — the bound travels with the kernel');
});

test('R12 env still overrides config (env 300 beats config 9000; invalid env still fails loudly even with a config value present)', () => {
  const config = { kernelTimeoutSeconds: { [PNR01]: 9000 } };
  assert(kernelTimeoutSecondsForKernel(PNR01, { MUTATION_TIER_KERNEL_TIMEOUT_S: '300' }, config) === 300,
    'the env override must still beat the config value (env > config > default)');
  assert(kernelTimeoutSecondsForKernel(PNR01, { MUTATION_TIER_KERNEL_TIMEOUT_S: '300' }, null) === 300,
    'the env override must work with no config object at all');
  let threw = null;
  try { kernelTimeoutSecondsForKernel(PNR01, { MUTATION_TIER_KERNEL_TIMEOUT_S: 'abc' }, config); } catch (e) { threw = e; }
  assert(threw && /MUTATION_TIER_KERNEL_TIMEOUT_S/.test(threw.message),
    'an invalid env value must still fail LOUDLY even when a config value exists (env semantics preserved)');
});

test('R13 invalid config value fails LOUDLY naming the kernel and the bad value (never a silent fallback to the default)', () => {
  for (const bad of [0, -5, 3.5, '9000', null]) {
    let threw = null;
    try { kernelTimeoutSecondsForKernel(PNR01, {}, { kernelTimeoutSeconds: { [PNR01]: bad } }); } catch (e) { threw = e; }
    assert(threw, `config value ${JSON.stringify(bad)} must be rejected, never silently defaulted`);
    assert(threw.message.includes(PNR01), `the rejection must name the kernel: ${threw.message}`);
    assert(threw.message.includes(JSON.stringify(bad)), `the rejection must name the bad value: ${threw.message}`);
    assert(/kernelTimeoutSeconds/.test(threw.message), `the rejection must name the config section: ${threw.message}`);
  }
});

test('R14 default 600 untouched when neither env nor a config entry names the kernel', () => {
  assert(kernelTimeoutSecondsForKernel('kernel-not-in-config', {}, { kernelTimeoutSeconds: { [PNR01]: 9000 } }) === 600,
    'a kernel NOT named in config must keep the 600 default (mms-03 and others keep the default until their own rows state otherwise)');
  assert(kernelTimeoutSecondsForKernel('kernel-not-in-config', {}, {}) === 600,
    'a config with no kernelTimeoutSeconds section at all must keep the 600 default');
  assert(kernelTimeoutSecondsForKernel('kernel-not-in-config', {}, null) === 600,
    'no config object at all must keep the 600 default');
});

// MUTATION-RATCHET-GREEN-1 (2026-10-26): the 10-26 nightly (run 40357657270, 20/20
// shards) MEASUREMENT-LOST 28 pinned kernels; 27 of them as 'MUTATION-TIER TIMEOUT
// <id> after 600s' (this list, each measured locally and landed a config bound of
// min(2x measured local wall, 1500 s)); the 28th, art-458-attribute-sampling-plan,
// hard-failed as 'stryker produced no report.json' (Stryker initial-test-run error at ~302 s on shard 10 — NOT a timeout, not curable by a bound; measured locally: same error at exactly 300 s). A further five of the 27 (see the config's STRICT-SOLO AMENDMENT) still hit 1500 s strictly solo — the brief's STOP — and are routed to hang rows with NO bound here; this list is the 22 landed bounds. R15 pins that batch's
// own invariant against the REAL config file — a future edit that pushes any of these past
// the row's 1500 s ceiling (or drops one back to an entry that cannot exceed the 600 s
// default it was cured from) fails HERE, not at the next nightly red.
const RATCHET_GREEN_1_TIMEOUT_KERNELS = [
  'ml-02-credit-default-risk-scorer', 'art-189-markdown-document-converter', 'art-628-declarative-decision-tree-evaluator', 'art-330-tvm-dv01',
  'art-280-reserve-proof-verifier', 'art-190-tabular-data-converter', 'art-326-tvm-xirr', 'art-595-ap2-cartmandate-hashchain-builder',
  'art-286-anchored-extract-verifier', 'art-612-erc2612-permit-binding-verifier', 'art-331-tvm-convexity', 'art-652-verify-receipt',
  'art-605-merkle-airdrop-proof-verifier', 'art-591-x402-signer-recovery-verifier', 'art-193-metadata-sanitization-prover', 'art-284-did-webvh-log-verifier',
  'art-194-digest-manifest-builder', 'qfa-04-xva-cva-calculator', 'art-329-tvm-bond-duration', 'art-653-pta-verifier',
  'art-02-agent-spend-policy-simulator', 'art-662-odnsf-fee-recompute',
];

test('R15 the MUTATION-RATCHET-GREEN-1 batch: every entry in the REAL config is an integer bound 600 < v <= 1500 and resolves per kernel', () => {
  const realConfig = loadConfig(); // merges the per-kernel <id>.mutation.json siblings (PER-KERNEL-CONFIG-SHARD-1)
  const bounds = realConfig.kernelTimeoutSeconds || {};
  for (const id of RATCHET_GREEN_1_TIMEOUT_KERNELS) {
    const v = bounds[id];
    assert(Number.isInteger(v), `kernelTimeoutSeconds["${id}"] must be present in the real config as an integer (got ${JSON.stringify(v)}) — the kernel reverts to the 600 s default it was cured from`);
    assert(v > 600, `kernelTimeoutSeconds["${id}"] = ${v} must EXCEED the 600 s default (the 10-26 nightly hard-timed-out at 600 s)`);
    assert(v <= 1500, `kernelTimeoutSeconds["${id}"] = ${v} must not exceed the row's 1500 s ceiling (min(2x measured local wall, 1500 s))`);
    assert(kernelTimeoutSecondsForKernel(id, {}, realConfig) === v,
      `the resolution must return the config value for "${id}" through the real config object`);
  }
});

// ── named mutate-surface split controls (RCA01-MUTATION-TIER-COST-1) ─────

console.log('\nrun-mutation-tier controls — named mutate-surface split (RCA01-MUTATION-TIER-COST-1)');

// A miniature kernel-shaped source carrying the SAME BEGIN/END marker comments the
// GENERATED fdlibm block uses in the estate's detmath-family kernels (rca-01 lines
// 3-1555; shrunken here — the markers are what matters, not the block's size).
const SPLIT_SRC = [
  '// header comment',
  '/* ===== BEGIN deterministic transcendental math (inlined; OCG SPEC Sec 18.5) ===== */',
  '// GENERATED by scratchpad/build_detmath.mjs - do not hand-edit; re-generate from source.',
  'const det = (function () {',
  '  const LN2_HI = 0.693359375; // fdlibm table constant',
  '  return { exp: (x) => x > 0 ? x : -x, log: (x) => x };',
  '})();',
  '/* ===== END deterministic transcendental math ===== */',
  'const TOOL_ID = "fixture-split";',
  'export const meta = { tool_id: TOOL_ID };',
  'export function compute(pp) { return det.exp(pp) + 1; }',
  'export function buildArtifact() { return {}; }',
].join('\n');

test('R15 findDetmathMarkerRange resolves the marker pair 1-indexed inclusive, and returns null when either marker is absent', () => {
  assert(JSON.stringify(findDetmathMarkerRange(SPLIT_SRC)) === JSON.stringify([2, 8]),
    `expected [2, 8] (the BEGIN line through the END line), got ${JSON.stringify(findDetmathMarkerRange(SPLIT_SRC))}`);
  assert(findDetmathMarkerRange('export function buildArtifact() { return 1; }') === null,
    'a source with no markers must resolve null, never a guessed range');
  assert(findDetmathMarkerRange(SPLIT_SRC.replace(/^\/\* ===== END.*\n/m, '')) === null,
    'a BEGIN without its END must resolve null (the caller fails loudly, never guesses)');
});

test('R16 surfaceSplitPatch appends the Stryker directive pair to the marker lines with ZERO line shift (CRLF preserved)', () => {
  const patched = surfaceSplitPatch(SPLIT_SRC, [[2, 8]]);
  const pLines = patched.split('\n');
  const sLines = SPLIT_SRC.split('\n');
  assert(pLines.length === sLines.length,
    `appending to the marker lines must not shift any line number: ${sLines.length} -> ${pLines.length}`);
  assert(/\/\/ Stryker disable all:/.test(pLines[1]) && /BEGIN deterministic transcendental math/.test(pLines[1]),
    `the disable directive must ride ON the BEGIN marker line, got: ${pLines[1]}`);
  assert(/\/\/ Stryker restore all$/.test(pLines[7]) && /END deterministic transcendental math/.test(pLines[7]),
    `the restore directive must ride ON the END marker line — and must carry the mandatory 'all' (Stryker 8.7.1's grammar requires the mutator list on restore too; a bare restore never matches and leaves every later mutant ignored), got: ${pLines[7]}`);
  assert(!/Stryker/.test(pLines.slice(8).join('\n')),
    'code after the END marker must carry no directive — TOOL_ID/meta/compute stay mutated');
  // The unmutated patched source must still be a behaviorally identical module: only comments differ.
  assert(patched.replace(/ ?\/\/ Stryker (disable all|restore)[^\n]*/g, '') === SPLIT_SRC,
    'stripping the directives must reproduce the original source byte-for-byte (comment-only patch)');
  const crlf = surfaceSplitPatch(SPLIT_SRC.replace(/\n/g, '\r\n'), [[2, 8]]);
  assert(crlf.split('\r\n')[1].includes('// Stryker disable all'),
    'the CRLF convention must be preserved (no LF-normalization of the sandbox copy)');
});

test('R17 resolveSurfaceSplit: no config entry -> null (every other kernel behaves exactly as before); malformed -> LOUD named throw', () => {
  assert(resolveSurfaceSplit('fixture-split', {}, SPLIT_SRC) === null,
    'no mutateSurfaceSplits section at all must resolve null — the default for every kernel');
  assert(resolveSurfaceSplit('fixture-split', { mutateSurfaceSplits: { 'other-kernel': { excludedRanges: [[2, 8]] } } }, SPLIT_SRC) === null,
    'a section naming a DIFFERENT kernel must resolve null for this one');
  const bad = (entry) => { try { resolveSurfaceSplit('fixture-split', { mutateSurfaceSplits: { 'fixture-split': entry } }, SPLIT_SRC); return null; } catch (e) { return e; } };
  assert(bad({}) && /excludedRanges/.test(bad({}).message),
    'a missing excludedRanges must fail loudly naming the config key');
  assert(bad({ excludedRanges: [[2]] }) && /excludedRanges/.test(bad({ excludedRanges: [[2]] }).message),
    'a malformed range must fail loudly naming the config key');
  const markerless = SPLIT_SRC.replace(/^\/\* ===== (BEGIN|END).*\n/m, '');
  const thrownMarkerless = (() => { try { resolveSurfaceSplit('fixture-split', { mutateSurfaceSplits: { 'fixture-split': { excludedRanges: [[2, 8]] } } }, markerless); return null; } catch (e) { return e; } })();
  assert(thrownMarkerless && /carries no BEGIN\/END/.test(thrownMarkerless.message),
    'an entry naming a markerless kernel must fail loudly — a named exclusion that names nothing is a config error, not a no-op');
});

test('R18 resolveSurfaceSplit: a recorded range that drifted from the kernel\'s real markers fails LOUDLY naming both numbers (stale config rots loudly)', () => {
  let threw = null;
  try { resolveSurfaceSplit('fixture-split', { mutateSurfaceSplits: { 'fixture-split': { excludedRanges: [[3, 1555]] } } }, SPLIT_SRC); } catch (e) { threw = e; }
  assert(threw, 'a drifted range must throw, never silently exclude the wrong lines');
  assert(threw.message.includes('3,1555') && threw.message.includes('lines 2-8'),
    `the failure must name BOTH the configured and the marker-resolved range:\n${threw.message}`);
  assert(threw.message.includes('fixture-split'), `the failure must name the kernel:\n${threw.message}`);
});

test('R19 resolveSurfaceSplit: the exact marker range resolves and the round-trip patch carries the directive pair exactly at the markers', () => {
  const resolved = resolveSurfaceSplit('fixture-split', { mutateSurfaceSplits: { 'fixture-split': { excludedRanges: [[2, 8]], reason: 'detmath tables' } } }, SPLIT_SRC);
  assert(resolved && JSON.stringify(resolved.excludedRanges) === JSON.stringify([[2, 8]]) && resolved.reason === 'detmath tables',
    `an exact-match entry must resolve with its ranges and reason, got ${JSON.stringify(resolved)}`);
  const patched = surfaceSplitPatch(SPLIT_SRC, resolved.excludedRanges);
  assert((patched.match(/\/\/ Stryker disable all/g) || []).length === 1 && (patched.match(/\/\/ Stryker restore/g) || []).length === 1,
    'exactly one disable/restore pair per patch — never a scattered or duplicated directive');
});

test('R20 ART699 vendored kind: a {kind:"vendored"} entry resolves on ANY kernel (no detmath markers needed) and the patch carries the directive pair on the sandbox copy only', () => {
  // A kernel-shaped source with NO detmath markers — exactly art-699's situation.
  const vendoredSrc = [
    '// header',
    '// ---- vendored inline: @noble/hashes keccak256 path only (see header) ----',
    'export const nobleConst = 0x1234n;',
    'export function nobleRound(s) { return s + 1n; }',
    '//# sourceMappingURL=sha3.js.map',
    '// -- art-699 Permit2 digest + binding logic --',
    'export function compute(input) { return nobleRound(BigInt(input)); }',
  ].join('\n');
  const sha256 = createHash('sha256').update(vendoredSrc.split('\n').slice(1, 5).join('\n')).digest('hex');
  const resolved = resolveSurfaceSplit('fixture-vendored', { mutateSurfaceSplits: { 'fixture-vendored': { kind: 'vendored', excludedRanges: [[2, 5]], sha256, reason: 'vendored noble' } } }, vendoredSrc);
  assert(resolved && resolved.kind === 'vendored' && JSON.stringify(resolved.excludedRanges) === JSON.stringify([[2, 5]]),
    `a vendored entry must resolve without any markers, got ${JSON.stringify(resolved)}`);
  const patched = surfaceSplitPatch(vendoredSrc, resolved.excludedRanges, 'vendored');
  const pLines = patched.split('\n');
  assert(pLines.length === vendoredSrc.split('\n').length, 'vendored patch must not shift any line number');
  assert(/\/\/ Stryker disable all/.test(pLines[1]) && /vendored/.test(pLines[1]), `disable rides the vendored banner line, got: ${pLines[1]}`);
  assert(/\/\/ Stryker restore all$/.test(pLines[4]), `restore rides the sourceMappingURL line, got: ${pLines[4]}`);
  assert(!/Stryker/.test(pLines.slice(5).join('\n')), 'the kernel\'s OWN logic (lines after the vendored block) stays fully mutated');
  assert(patched.replace(/ ?\/\/ Stryker (disable all|restore)[^\n]*/g, '') === vendoredSrc, 'stripping directives reproduces the original byte-for-byte — sandbox-only patch, zero tracked bytes');
});

test('R21 ART699 vendored kind: a stale sha256 or an out-of-source range fails LOUDLY naming the kernel, range and both hashes (drifted vendored block rots loudly)', () => {
  const vendoredSrc = '// banner\nconst a = 1;\nconst b = 2;\n// end\nexport function compute() { return a + b; }';
  const entry = (sha256, range) => ({ mutateSurfaceSplits: { 'fixture-vendored': { kind: 'vendored', excludedRanges: [range], sha256 } } });
  const good = createHash('sha256').update(vendoredSrc.split('\n').slice(0, 4).join('\n')).digest('hex');
  const drifted = createHash('sha256').update('different bytes entirely').digest('hex');
  let threw = null;
  try { resolveSurfaceSplit('fixture-vendored', entry(drifted, [1, 4]), vendoredSrc); } catch (e) { threw = e; }
  assert(threw, 'a stale sha256 must throw, never silently exclude a block that changed');
  assert(threw.message.includes('fixture-vendored') && threw.message.includes('[1, 4]') && threw.message.includes(drifted.slice(0, 16)) && threw.message.includes(good.slice(0, 16)),
    `the failure must name the kernel, the range and BOTH hashes:\n${threw.message}`);
  threw = null;
  try { resolveSurfaceSplit('fixture-vendored', entry(good, [1, 99]), vendoredSrc); } catch (e) { threw = e; }
  assert(threw && /outside the 5-line source/.test(threw.message),
    `a range past EOF must fail loudly like the detmath check does:\n${threw && threw.message}`);
  threw = null;
  try { resolveSurfaceSplit('fixture-vendored', { mutateSurfaceSplits: { 'fixture-vendored': { kind: 'vendored', excludedRanges: [[1, 4]] } } }, vendoredSrc); } catch (e) { threw = e; }
  assert(threw && /sha256 pin/.test(threw.message), 'a vendored entry without a sha256 pin must fail loudly — an unpinned exclusion can never rot loudly');
});

test('R22 the real art-699 entry: config range+sha256 match the tracked kernel, and the tracked file carries no Stryker directive', () => {
  const kernelPath = join(import.meta.dirname, '..', 'chaingraph', 'kernels', 'art-699-x402-permit2-evidence-recomputer.kernel.mjs');
  const config = loadConfig();
  const entry = config.mutateSurfaceSplits['art-699-x402-permit2-evidence-recomputer'];
  assert(entry && entry.kind === 'vendored', 'art-699 must carry a vendored mutateSurfaceSplits entry');
  const src = readFileSync(kernelPath, 'utf8');
  // Resolving against the REAL tracked source must succeed (range+sha256 in sync)…
  const resolved = resolveSurfaceSplit('art-699-x402-permit2-evidence-recomputer', config, src);
  assert(resolved && resolved.excludedRanges.length === 1, `the real entry must resolve, got ${JSON.stringify(resolved)}`);
  const [s, e] = resolved.excludedRanges[0];
  const lines = src.split(/\r?\n/);
  assert(/vendored inline/.test(lines[s - 1]) && /sourceMappingURL=sha3\.js\.map/.test(lines[e - 1]),
    `the pinned range [${s}, ${e}] must land on the vendored banner and the sourceMappingURL end line`);
  // …and the TRACKED kernel must carry no directive (the injection is sandbox-copy only).
  assert(!/Stryker/.test(src), 'the tracked art-699 kernel must carry zero Stryker directives — zero kernel bytes changed');
});

// ── runtime-read fixture siblings (MUTATION-TIER-SANDBOX-FIXTURES-1) ─────
// deriveSandboxFiles() walks the static IMPORT graph, so a proptest that runtime-reads a
// fixtures sibling (fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID +
// '.reachability.json')) — the estate template, art-663-apy-earned-recompute.proptest.mjs:29)
// is invisible to it: copySandboxDeps passed ONLY <id>.fixtures.json as an extra, the sandbox
// lacked the sibling, and Stryker's initial test run died with a bare ENOENT — hard-failing the
// pre-push hook for every reachability-pattern kernel while the nightly silently never measured
// them (the same bug handled asymmetrically). The cure is caller-side: copySandboxDeps itself
// readdir-matches every EXISTING `<id>.*.json` fixture sibling beyond <id>.fixtures.json into
// the extras list — future-proof for any runtime-read sibling, not just reachability.

const SIBLING_FIXTURE_REPO = buildRuntimeReadFixtureRepo();

function buildRuntimeReadFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'rmt-fixture-reach-'));
  cleanup.push(root);
  const kernelsDir = join(root, 'chaingraph', 'kernels');
  const proptestsDir = join(kernelsDir, '__proptests__');
  const fixturesDir = join(kernelsDir, 'fixtures');
  mkdirSync(proptestsDir, { recursive: true });
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(join(kernelsDir, 'reach-k.kernel.mjs'), "export function buildArtifact() { return 1; }\n");
  // Mirrors the estate's reachability pattern: the proptest RUNTIME-READS the sibling via
  // fs.readFileSync — no import edge, invisible to any static-derivation walk.
  writeFileSync(join(proptestsDir, 'reach-k.proptest.mjs'), [
    "import { readFileSync } from 'node:fs';",
    "import { join, dirname } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    "const HERE = dirname(fileURLToPath(import.meta.url));",
    "const reach = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'reach-k.reachability.json'), 'utf8'));",
    "console.log(reach.ok);",
  ].join('\n'));
  writeFileSync(join(fixturesDir, 'reach-k.fixtures.json'), '{"vectors":[]}\n');
  writeFileSync(join(fixturesDir, 'reach-k.reachability.json'), '{"ok":true}\n');
  return {
    root,
    kernelRelPath: 'chaingraph/kernels/reach-k.kernel.mjs',
    proptestRelPath: 'chaingraph/kernels/__proptests__/reach-k.proptest.mjs',
    fixturesRelPath: 'chaingraph/kernels/fixtures/reach-k.fixtures.json',
    siblingRelPath: 'chaingraph/kernels/fixtures/reach-k.reachability.json',
  };
}

test('R23 copySandboxDeps() carries a runtime-read fixtures sibling (<id>.reachability.json) the import graph cannot see', () => {
  const fx = SIBLING_FIXTURE_REPO;
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-reach-'));
  cleanup.push(scratchRoot);
  const files = copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root);
  assert(existsSync(join(scratchRoot, fx.siblingRelPath)),
    `the runtime-read sibling reach-k.reachability.json must be IN the sandbox — without it Stryker's initial run dies with ENOENT (the reproduced defect); got files=${JSON.stringify(files)}`);
  assert(files.includes(fx.siblingRelPath), `the derived file list must name the sibling; got ${JSON.stringify(files)}`);
  assert(existsSync(join(scratchRoot, fx.fixturesRelPath)), '<id>.fixtures.json must still be copied');
  // And the sandboxed proptest must actually RUN against the copied sandbox (the ENOENT is gone):
  const run = runProcessBoundedSync(join(scratchRoot, fx.proptestRelPath), scratchRoot);
  assert(run.code === 0, `the sandboxed proptest must execute cleanly against the sandbox; got code=${run.code} stderr=${run.stderr.slice(0, 400)}`);
});

test('R24 the same cure leaves non-sibling fixture files (other kernels\' fixtures) OUT of the sandbox', () => {
  const fx = SIBLING_FIXTURE_REPO;
  writeFileSync(join(fx.root, 'chaingraph', 'kernels', 'fixtures', 'other-k.fixtures.json'), '{}\n');
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-reach2-'));
  cleanup.push(scratchRoot);
  const files = copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root);
  assert(!existsSync(join(scratchRoot, 'chaingraph/kernels/fixtures/other-k.fixtures.json')),
    `another kernel's fixture must not be swept in (prefix match on "reach-k." only); got files=${JSON.stringify(files)}`);
});

// Sync helper: run a scratch file as a child so R23 proves the sandbox is actually loadable,
// not merely file-complete. Bounded so a hanging proptest can never hang the test file.
function runProcessBoundedSync(file, cwd) {
  const r = spawnSync(process.execPath, [file], { cwd, encoding: 'utf8', timeout: 30000 });
  return { code: r.status ?? -1, stderr: r.stderr || '' };
}

// ── per-mutant survivor detail (MUTATION-SURVIVORS-JSON-1) ───────────────
// --survivors is an OPT-IN additive projection of the Stryker report the
// harness already read: per-kernel `survivors` (every Survived / NoCoverage
// mutant, tier as assigned, sorted line then column) plus
// `killed_money_math_ids`. WITHOUT the flag the --json output must be
// byte-identical to the pre-row shape. No count, tier, floor or percentage
// is derived from any of it.

console.log('\nrun-mutation-tier controls — per-mutant survivor detail (MUTATION-SURVIVORS-JSON-1)');

// Fixture Stryker report, same inline convention as R7's decompose fixtures.
// Covers: money-math Survivor (m5), money-math NoCoverage (m8), peripheral
// Survivor (m6 inside the peripheral range), Killed (never a survivor), and
// Ignored (excluded from the measured surface — never a survivor).
const SURV_RANGES = [[9000, 9100]];
const SURV_KERNEL = 'chaingraph/kernels/fixture-id.kernel.mjs';
const SURV_FIXTURE_REPORT = { files: { [SURV_KERNEL]: { mutants: [
  { id: 'm1', status: 'Killed', mutatorName: 'ArithmeticOperator', location: { start: { line: 10, column: 3 }, end: { line: 10, column: 8 } } },
  { id: 'm8', status: 'NoCoverage', mutatorName: 'BlockStatement', location: { start: { line: 50, column: 1 }, end: { line: 52, column: 2 } } },
  { id: 'm5', status: 'Survived', mutatorName: 'ConditionalExpression', location: { start: { line: 50, column: 9 }, end: { line: 50, column: 20 } } },
  { id: 'm3', status: 'Killed', mutatorName: 'StringLiteral', location: { start: { line: 30, column: 5 }, end: { line: 30, column: 12 } } },
  { id: 'm6', status: 'Survived', mutatorName: 'ArrowFunction', location: { start: { line: 9050, column: 7 }, end: { line: 9050, column: 15 } } },
] } } };

test('R25 survivorLocations: exactly the Survived/NoCoverage mutants, tier as assigned, sorted by line then column', () => {
  const survivors = survivorLocations(SURV_FIXTURE_REPORT, SURV_KERNEL, SURV_RANGES);
  assert(JSON.stringify(survivors) === JSON.stringify([
    { id: 'm8', mutatorName: 'BlockStatement', tier: 'moneyMath', location: { start: { line: 50, column: 1 }, end: { line: 52, column: 2 } }, status: 'NoCoverage' },
    { id: 'm5', mutatorName: 'ConditionalExpression', tier: 'moneyMath', location: { start: { line: 50, column: 9 }, end: { line: 50, column: 20 } }, status: 'Survived' },
    { id: 'm6', mutatorName: 'ArrowFunction', tier: 'peripheral', location: { start: { line: 9050, column: 7 }, end: { line: 9050, column: 15 } }, status: 'Survived' },
  ]), `survivors must be exactly the 3 Survived/NoCoverage mutants, line-then-column sorted, got ${JSON.stringify(survivors)}`);
  assert(!survivors.some((s) => s.id === 'm1' || s.id === 'm3'),
    'Killed mutants must never appear in survivors');
});

test('R26 WITHOUT --survivors the result shape is byte-identical to the pre-row `{ id, runtimeMs, tiers, decomposed }`', () => {
  const tiers = { moneyMath: { total: 5, killed: 4, score: 80 }, peripheral: { total: 0, killed: 0, score: null } };
  const decomposed = { total: 5, killedAsShipped: 4, propertyKills: 3, fixtureKills: 1, run2OnlyKills: 0, propertyRatio: 60 };
  const pre = JSON.stringify({ id: 'k', runtimeMs: 1234, tiers, decomposed });
  const after = JSON.stringify(buildJsonResult('k', 1234, tiers, decomposed, { survivors: false }, null));
  assert(pre === after, `default output must be byte-identical to the pre-row shape:\n  pre:   ${pre}\n  after: ${after}`);
  // Even a stray bundle must never leak into a non-flagged result:
  const stray = JSON.stringify(buildJsonResult('k', 1234, tiers, decomposed, { survivors: false }, { survivors: [{ id: 'm5' }], killed_money_math_ids: ['m1'] }));
  assert(pre === stray, 'a bundle passed with the flag off must be dropped — the default output never gains survivor keys');
  // With the flag on, the keys are ADDITIVE — the base keys are unchanged:
  const flagged = buildJsonResult('k', 1234, tiers, decomposed, { survivors: true }, { survivors: [{ id: 'm5' }], killed_money_math_ids: ['m1'] });
  assert(flagged.id === 'k' && flagged.runtimeMs === 1234 && flagged.tiers === tiers && flagged.decomposed === decomposed,
    'the flagged result must carry the exact same base fields');
  assert(JSON.stringify(flagged.survivors) === '[{"id":"m5"}]' && JSON.stringify(flagged.killed_money_math_ids) === '["m1"]',
    'the flagged result must carry survivors and killed_money_math_ids additively');
});

test('R27 RED case: a Survived mutant missing from the survivors array fails LOUDLY naming the mutant id', () => {
  const survivors = survivorLocations(SURV_FIXTURE_REPORT, SURV_KERNEL, SURV_RANGES);
  assertSurvivorsComplete(SURV_FIXTURE_REPORT, survivors, SURV_KERNEL, SURV_RANGES); // the honest array must pass
  for (const dropped of survivors) {
    const corrupted = survivors.filter((s) => s.id !== dropped.id);
    let threw = null;
    try { assertSurvivorsComplete(SURV_FIXTURE_REPORT, corrupted, SURV_KERNEL, SURV_RANGES); } catch (e) { threw = e; }
    assert(threw, `dropping ${dropped.id} from survivors must fail — a survivor silently dropped from the reviewable output is the exact defect this row closes`);
    assert(threw.message.includes(dropped.id) && /MUTATION-SURVIVORS-JSON-1/.test(threw.message),
      `the failure must name the missing mutant id and the row:\n${threw.message}`);
  }
});

// ── artifact-only const tier (MUTATION-ARTIFACT-CONST-TIER-1, SO #41) ──────
// A DECLARED metric-definition change: mutants inside a top-level const whose
// every reference provably sits in artifact-building code (buildArtifact/meta,
// never anything reachable from compute()) leave the money-math tier and
// report in a THIRD tier, `artifact` — counted, never scored against any
// floor. The classifier is PROOF-ONLY: every case it cannot decide keeps the
// pre-change money-math classification (under-claiming is the safe
// direction — the artifact tier can never hide a compute()-reachable mutant).

console.log('\nrun-mutation-tier controls — artifact-only const tier (MUTATION-ARTIFACT-CONST-TIER-1)');

// Fixture kernel, canonical shape, one line per array entry so line numbers
// are countable below. Covers every decision the classifier makes:
//   line 3  META_BADGE      — referenced only from meta (artifact root)
//   line 5  ARTIFACT_ONLY   — referenced only from buildArtifact (artifact root)
//   line 9  DEEP_ARTIFACT   — referenced only from ARTIFACT_CHAIN's initializer (fixpoint)
//   line 10 ARTIFACT_CHAIN  — referenced only from buildArtifact
//   line 11 COMPUTE_TABLE   — read by compute() → stays money-math
//   line 12 HELPER_DATA     — referenced from a top-level helper's body → stays money-math
//   line 14 EXPORTED_ARTIFACT — `export const`, referenced only from buildArtifact → DENIED (cross-file reachability is undecidable; art-376's `export const __test__` is the measured case)
//   line 16 LOCAL_DEAD      — declared inside compute(), zero references → DENIED (a local, not a top-level const)
const ART_KERNEL_LINES = [
  "const TOOL_ID = 'fixture-id';",                                                                       // 1
  "const TOOL_VERSION = '1.0.0';",                                                                       // 2
  "const META_BADGE = { shape: 'round' };",                                                              // 3
  "export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, badge: META_BADGE };",            // 4
  "const ARTIFACT_ONLY = {",                                                                             // 5
  "  label: 'envelope-label',",                                                                          // 6
  "  digest: 'sha256:abcdef',",                                                                          // 7
  "};",                                                                                                  // 8
  "const DEEP_ARTIFACT = { scale: 2 };",                                                                 // 9
  "const ARTIFACT_CHAIN = { nested: DEEP_ARTIFACT };",                                                   // 10
  "const COMPUTE_TABLE = [1, 2, 3];",                                                                    // 11
  "const HELPER_DATA = { pad: 7 };",                                                                     // 12
  "function padOut(x) { return x + HELPER_DATA.pad; }",                                                  // 13
  "export const EXPORTED_ARTIFACT = { ev: 1 };",                                                         // 14
  "export function compute(pp) {",                                                                       // 15
  "  const LOCAL_DEAD = { z: 9 };",                                                                      // 16
  "  return COMPUTE_TABLE[pp.i] + padOut(1);",                                                           // 17
  "}",                                                                                                    // 18
  "export function buildArtifact(x) {",                                                                  // 19
  "  return { envelope: ARTIFACT_ONLY, chained: ARTIFACT_CHAIN, exported: EXPORTED_ARTIFACT };",         // 20
  "}",                                                                                                    // 21
];
const ART_KERNEL = ART_KERNEL_LINES.join('\n') + '\n';
const ART_KERNEL_REL = 'chaingraph/kernels/fixture-art.kernel.mjs';
const { peripheralRanges: ART_PERIPHERAL } = classifyKernelSource(ART_KERNEL);
const ART_MUTANT = (id, line, status) => ({ id, status, mutatorName: 'ObjectLiteral', location: { start: { line, column: 1 }, end: { line, column: 2 } } });
// Stryker-report fixture: mutants at every decision line above. Artifact
// lines (3, 6, 7, 9) carry only non-executed statuses (NoCoverage/Survived) —
// artifact code is never run by the floors, the same shape the step-1
// re-measure confirmed on art-348's live report.
const ART_REPORT = { files: { [ART_KERNEL_REL]: { mutants: [
  ART_MUTANT('a1', 3, 'NoCoverage'),   // META_BADGE decl → artifact
  ART_MUTANT('a2', 6, 'Survived'),     // inside ARTIFACT_ONLY → artifact
  ART_MUTANT('a3', 7, 'NoCoverage'),   // inside ARTIFACT_ONLY → artifact
  ART_MUTANT('a4', 9, 'Survived'),     // DEEP_ARTIFACT decl → artifact
  ART_MUTANT('m1', 11, 'Killed'),      // COMPUTE_TABLE → money-math
  ART_MUTANT('m2', 14, 'NoCoverage'),  // EXPORTED_ARTIFACT → money-math (export denial)
  ART_MUTANT('m3', 16, 'NoCoverage'),  // LOCAL_DEAD inside compute() → money-math
  ART_MUTANT('m4', 17, 'Killed'),      // compute body → money-math
  ART_MUTANT('m5', 13, 'Killed'),      // padOut helper body → money-math
  ART_MUTANT('p1', 4, 'NoCoverage'),   // meta body → peripheral
  ART_MUTANT('p2', 20, 'NoCoverage'),  // buildArtifact body → peripheral
] } } };

test('R28 artifactConstRanges grants EXACTLY the provably artifact-only consts — and denies every undecidable shape (proof-only, never a guess)', () => {
  const { artifactConsts, artifactRanges } = artifactConstRanges(ART_KERNEL, ART_PERIPHERAL);
  const granted = artifactConsts.map((c) => `${c.name}:${c.range[0]}-${c.range[1]}`).sort();
  const expected = ['ARTIFACT_CHAIN:10-10', 'ARTIFACT_ONLY:5-8', 'DEEP_ARTIFACT:9-9', 'META_BADGE:3-3'];
  assert(JSON.stringify(granted) === JSON.stringify(expected),
    `granted set must be exactly ${expected.join(', ')} (meta-fed, buildArtifact-fed, and the fixpoint chain), got ${granted.join(', ')}`);
  assert(artifactRanges.length === 4, `artifactRanges must carry the four granted ranges, got ${artifactRanges.length}`);
  for (const denied of ['COMPUTE_TABLE', 'HELPER_DATA', 'EXPORTED_ARTIFACT', 'LOCAL_DEAD']) {
    assert(!artifactConsts.some((c) => c.name === denied),
      `${denied} must NEVER be granted artifact (compute-read / helper-read / exported / function-local) — granting it would hide real money-math`);
  }
});

test('R29 RED/GREEN: the artifact tier takes ONLY the proven consts' + "' mutants; money-math keeps its kills and every other count is unchanged", () => {
  const { artifactRanges } = artifactConstRanges(ART_KERNEL, ART_PERIPHERAL);
  const before = tierReport(ART_REPORT, ART_KERNEL_REL, ART_PERIPHERAL);            // the pre-change classification
  const after = tierReportWithArtifact(ART_REPORT, ART_KERNEL_REL, ART_PERIPHERAL, artifactRanges);
  // GREEN shape: the four artifact lines moved; nothing else did.
  assert(after.artifact.total === 4 && after.artifact.killed === 0,
    `artifact bucket must hold exactly the 4 proven-const mutants (0 killed — never executed), got total ${after.artifact.total} killed ${after.artifact.killed}`);
  assert(after.moneyMath.total === before.moneyMath.total - 4 && after.moneyMath.killed === before.moneyMath.killed,
    `money-math must shrink by exactly the artifact count with kills unchanged: before ${before.moneyMath.killed}/${before.moneyMath.total}, after ${after.moneyMath.killed}/${after.moneyMath.total}`);
  assert(after.moneyMath.score === 60 && before.moneyMath.score === 33.3,
    `money-math score rises from 33.3% (3/9, artifact mutants in the denominator) to 60% (3/5) — got before ${before.moneyMath.score} after ${after.moneyMath.score}`);
  assert(JSON.stringify(after.peripheral) === JSON.stringify(before.peripheral),
    'peripheral must be byte-identical (artifact never steals from peripheral)');
  // A const read by compute() stays money-math — the row's explicit case:
  assert(tierOfMutantWithArtifact(ART_MUTANT('m1x', 11, 'Killed'), ART_KERNEL_REL, ART_KERNEL_REL, ART_PERIPHERAL, artifactRanges) === 'moneyMath',
    'COMPUTE_TABLE (read by compute()) must stay money-math');
  assert(tierOfMutantWithArtifact(ART_MUTANT('a1x', 6, 'Survived'), ART_KERNEL_REL, ART_KERNEL_REL, ART_PERIPHERAL, artifactRanges) === 'artifact',
    'a mutant inside ARTIFACT_ONLY must classify artifact');
});

test('R30 survivorLocations labels artifact-tier survivors artifact and the completeness self-check still passes (every survivor present)', () => {
  const { artifactRanges } = artifactConstRanges(ART_KERNEL, ART_PERIPHERAL);
  const survivors = survivorLocations(ART_REPORT, ART_KERNEL_REL, ART_PERIPHERAL, artifactRanges);
  const byId = Object.fromEntries(survivors.map((s) => [s.id, s]));
  assert(byId.a1 && byId.a1.tier === 'artifact' && byId.a2 && byId.a2.tier === 'artifact' && byId.a4 && byId.a4.tier === 'artifact',
    `artifact survivors (a1/a2/a4) must carry tier 'artifact', got ${survivors.filter((s) => s.tier === 'artifact').map((s) => s.id).join(',')}`);
  assert(byId.m2 && byId.m2.tier === 'moneyMath' && byId.m3 && byId.m3.tier === 'moneyMath',
    'denied-const survivors (m2 EXPORTED_ARTIFACT, m3 LOCAL_DEAD) stay moneyMath');
  assert(byId.p1 && byId.p1.tier === 'peripheral', 'peripheral survivor keeps its tier');
  assertSurvivorsComplete(ART_REPORT, survivors, ART_KERNEL_REL, ART_PERIPHERAL); // must not throw
});

test('R31 with no artifact ranges the classification is EXACTLY the pre-change tierReport plus an empty artifact bucket (default behavior unchanged)', () => {
  const before = tierReport(ART_REPORT, ART_KERNEL_REL, ART_PERIPHERAL);
  const after = tierReportWithArtifact(ART_REPORT, ART_KERNEL_REL, ART_PERIPHERAL);
  assert(JSON.stringify(after.moneyMath) === JSON.stringify(before.moneyMath)
    && JSON.stringify(after.peripheral) === JSON.stringify(before.peripheral)
    && JSON.stringify(after.other) === JSON.stringify(before.other),
    'an empty artifactRanges default must reclassify nothing');
  assert(after.artifact.total === 0 && after.artifact.score === null, 'the empty artifact bucket reports zero');
});

// ── per-kernel sibling config (PER-KERNEL-CONFIG-SHARD-1) ────────────────
// Per-kernel entries live in chaingraph/kernels/<id>.mutation.json and
// <stem>.authorship.json. loadConfig() reads from the REAL checkout (repoRoot), not the
// Stryker sandbox, so the siblings never need to be copied into a sandbox.

console.log('\nrun-mutation-tier controls — per-kernel sibling config (PER-KERNEL-CONFIG-SHARD-1)');

function siblingScratch(files, base = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rmt-pkc-'));
  cleanup.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), JSON.stringify(body));
  return { dir, base };
}

test('R32 mergeMutationSiblings merges every sibling key into its map and leaves the base untouched', () => {
  const { dir } = siblingScratch({
    'k-a.mutation.json': { kernelTimeoutSeconds: 1234, hookSkip: 'why' },
    'k-b.mutation.json': { namedLead: 'lead', excluded: 'shape' },
  });
  const base = { moneyMathBreakFloor: 60, kernelTimeoutSeconds: { 'k-z': 9 }, hookSkipKernels: { _comment: 'c' } };
  const m = mergeMutationSiblings(base, dir);
  assert(m.kernelTimeoutSeconds['k-a'] === 1234 && m.kernelTimeoutSeconds['k-z'] === 9, 'sibling timeout merged alongside the base entry');
  assert(m.hookSkipKernels['k-a'] === 'why' && m.hookSkipKernels._comment === 'c', 'hookSkip merged, _comment kept');
  assert(m.namedLeads['k-b'] === 'lead' && m.excludedKernels['k-b'] === 'shape', 'namedLead/excluded merged into maps absent from the base');
  assert(m.moneyMathBreakFloor === 60 && !('k-a' in base.kernelTimeoutSeconds), 'shared keys carried, base not mutated');
});

test('R33 an id present in BOTH the legacy map and a sibling, or an unknown sibling key, is a loud refusal', () => {
  const { dir } = siblingScratch({ 'k-a.mutation.json': { kernelTimeoutSeconds: 5 } });
  let threw = null;
  try { mergeMutationSiblings({ kernelTimeoutSeconds: { 'k-a': 7 } }, dir); } catch (e) { threw = e; }
  assert(threw && /already present/.test(threw.message), `duplicate must be refused, got ${threw && threw.message}`);
  const bad = siblingScratch({ 'k-b.mutation.json': { kernelTimeoutSecond: 5 } });
  threw = null;
  try { mergeMutationSiblings({}, bad.dir); } catch (e) { threw = e; }
  assert(threw && /unknown key/.test(threw.message), `unknown key must be refused, got ${threw && threw.message}`);
});

test('R34 loadOriginalAuthorshipAllowlist keys a sibling as chaingraph/kernels/<stem>.mjs and refuses a duplicate legacy key', () => {
  const root = mkdtempSync(join(tmpdir(), 'rmt-pkc-auth-'));
  cleanup.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'chaingraph', 'kernels'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'original-authorship-bundle-allowlist.json'), JSON.stringify({ _README: { reason: 'r' } }));
  writeFileSync(join(root, 'chaingraph', 'kernels', '_x.bundle.authorship.json'), JSON.stringify({ reason: 'original' }));
  const a = loadOriginalAuthorshipAllowlist(root);
  assert(a['chaingraph/kernels/_x.bundle.mjs'] && a['chaingraph/kernels/_x.bundle.mjs'].reason === 'original', `sibling must key to the bundle path, got ${Object.keys(a)}`);
  writeFileSync(join(root, 'scripts', 'original-authorship-bundle-allowlist.json'), JSON.stringify({ 'chaingraph/kernels/_x.bundle.mjs': { reason: 'dup' } }));
  let threw = null;
  try { loadOriginalAuthorshipAllowlist(root); } catch (e) { threw = e; }
  assert(threw && /already present/.test(threw.message), 'a duplicate legacy+sibling entry must be refused');
});

// ── per-kernel trial budget (MUTATION-TRIALS-BUDGET-458-1) ────────────────
// The key is sibling-only (no global env override), validated as a positive
// safe integer, and travels into the Stryker child env ONLY for the kernel that
// declares it. No key = empty fragment = byte-identical behaviour.

console.log('\nrun-mutation-tier controls — per-kernel trial budget (MUTATION-TRIALS-BUDGET-458-1)');

test('R35 mutationTrials is allowlisted, merged, accepted and validated (bad values refused loudly)', () => {
  const { dir } = siblingScratch({ 'k-a.mutation.json': { mutationTrials: 1000 }, 'k-b.mutation.json': { mutationTrials: 0 } });
  let m;
  try { m = mergeMutationSiblings({}, dir); } catch (e) { throw new Error(`mutationTrials key is not allowlisted: ${e.message}`); }
  assert(m.mutationTrials['k-a'] === 1000 && m.mutationTrials['k-b'] === 0, 'mutationTrials must merge into its own map');
  assert(mutationTrialsForKernel('k-a', m) === 1000, 'a positive safe integer must be accepted');
  assert(mutationTrialsForKernel('k-z', m) === null, 'a kernel without the key resolves to null (no budget)');
  for (const bad of [0, -1, 3.5, '1000', null, Number.MAX_SAFE_INTEGER + 1]) {
    let threw = null;
    try { mutationTrialsForKernel('k-a', { mutationTrials: { 'k-a': bad } }); } catch (e) { threw = e; }
    assert(threw, `${JSON.stringify(bad)} must be refused, never silently accepted`);
    assert(threw.message.includes('k-a') && /mutationTrials/.test(threw.message), `the refusal must name the kernel and the key: ${threw && threw.message}`);
  }
});

test('R36 no key means no env var, and computing the fragment never writes global process.env', () => {
  const config = { mutationTrials: { 'k-a': 1000 } };
  const before = process.env.MUTATION_TIER_NUM_RUNS;
  const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}`);
  eq(mutationEnvForKernel('k-a', config), { MUTATION_TIER_NUM_RUNS: '1000' }, 'the keyed kernel gets exactly the budget var');
  eq(mutationEnvForKernel('k-b', config), {}, 'an unkeyed kernel gets no var at all');
  eq(mutationEnvForKernel('k-a', null), {}, 'no config means no var');
  assert(process.env.MUTATION_TIER_NUM_RUNS === before, 'mutationEnvForKernel must never mutate global process.env');
});

await asyncTest('R37 the computed env reaches a spawned child for the keyed kernel only', async () => {
  const config = { mutationTrials: { 'k-a': 1000 } };
  const envForA = { ...process.env, ...mutationEnvForKernel('k-a', config) };
  const envForB = { ...process.env };
  delete envForB.MUTATION_TIER_NUM_RUNS;
  const code = "process.stdout.write(String(process.env.MUTATION_TIER_NUM_RUNS || ''));";
  const a = spawnSync(process.execPath, ['-e', code], { env: envForA, encoding: 'utf8' });
  const b = spawnSync(process.execPath, ['-e', code], { env: envForB, encoding: 'utf8' });
  assert(a.status === 0 && a.stdout === '1000', `the keyed kernel's child must see 1000 (got ${a.stdout})`);
  assert(b.status === 0 && b.stdout === '', `the unkeyed kernel's child must see no var (got ${b.stdout})`);
});

// Numbered AB1..AB8 (not R38+) so this block cannot collide with #3271's R-numbers.
console.log('\nrun-mutation-tier controls — sandbox trial hook + auto budget (MUTATION-TRIALS-AUTO-BUDGET-1)');

const { sandboxTrialsHook, chooseAutoTrials, autoTrialBudgetConfig, resolveTrialsEnv, parseDryRunLog } = await import('./run-mutation-tier.mjs');
const PLAIN_FLOOR = "import x from './y.mjs';\nconst TRIALS = 4000;\nlet n = 0; for (let i = 0; i < TRIALS; i++) n++;\nprocess.stdout.write(String(n));\n";

test('AB1 the hook rewrites exactly one top-level `const TRIALS = N;` and the env reaches it (unset = shipped count, cap never above it)', () => {
  const h = sandboxTrialsHook(PLAIN_FLOOR);
  assert(h.status === 'patched' && h.fullTrials === 4000, `expected patched/4000, got ${h.status}/${h.fullTrials}`);
  assert(!/^const TRIALS = 4000;/m.test(h.source) && h.source.includes('MUTATION_TIER_NUM_RUNS'), 'the literal declaration must be replaced by the env-reading one');
  assert(h.source.split('\n')[0] === PLAIN_FLOOR.split('\n')[0], 'nothing outside the declaration may change');
  const body = h.source.split('\n').slice(1).join('\n');
  const run = (env) => {
    const e = { ...process.env }; delete e.MUTATION_TIER_NUM_RUNS; Object.assign(e, env);
    return spawnSync(process.execPath, ['--input-type=module', '-e', body], { env: e, encoding: 'utf8' }).stdout;
  };
  assert(run({}) === '4000', `unset env must run the shipped 4000 trials (got ${run({})})`);
  assert(run({ MUTATION_TIER_NUM_RUNS: '50' }) === '50', 'a budget of 50 must run 50 trials');
  assert(run({ MUTATION_TIER_NUM_RUNS: '99999' }) === '4000', 'a budget above the shipped count must never raise it');
  assert(run({ MUTATION_TIER_NUM_RUNS: 'junk' }) === '4000', 'a junk value falls back to the shipped count');
});

test('AB2 the hook leaves native, own-cap and ambiguous floors alone', () => {
  assert(sandboxTrialsHook('const TRIALS = Number(process.env.MUTATION_TIER_NUM_RUNS) || 10;\n').status === 'native', 'env-reading floor is native');
  assert(sandboxTrialsHook('const MUTATION_MODE = true;\nconst TRIALS = MUTATION_MODE ? 50 : 4000;\n').status === 'own-cap', 'MUTATION_MODE floor keeps its own cap');
  assert(sandboxTrialsHook('let c = process.env.PROPFLOOR_TRIAL_CAP;\nconst TRIALS = 4000;\n').status === 'own-cap', 'PROPFLOOR_TRIAL_CAP floor keeps its own cap');
  assert(sandboxTrialsHook('const TRIALS = 10;\nconst TRIALS = 20;\n').status === 'no-single-decl', 'two declarations are ambiguous');
  assert(sandboxTrialsHook('function f() {\n  const TRIALS = 10;\n}\n').status === 'no-single-decl', 'an indented (non-top-level) declaration is not hooked');
  assert(sandboxTrialsHook('const N = 3;\n').status === 'no-single-decl', 'no declaration, no hook');
});

test('AB3 chooseAutoTrials: a kernel whose estimate fits keeps full trials; one that does not gets the largest count fitting the target', () => {
  const base = { fullTrials: 5000, t1Ms: 100, minTrials: 50, targetFraction: 0.6, boundS: 600, concurrency: 2 };
  const fits = chooseAutoTrials({ ...base, tFullMs: 1000, mutants: 400 }); // 400 x 1 s / 2 = 200 s
  assert(fits.trials === null && /fits/.test(fits.reason), `200 s estimate must keep full trials: ${JSON.stringify(fits)}`);
  const big = chooseAutoTrials({ ...base, tFullMs: 5100, mutants: 400 }); // 400 x 5.1 / 2 = 1020 s
  assert(big.trials !== null && big.trials >= 50 && big.trials < 5000, `1020 s estimate must budget: ${JSON.stringify(big)}`);
  const perTrial = (5.1 - 0.1) / 4999;
  const est = (k) => (400 * (0.1 + (k - 1) * perTrial)) / 2;
  assert(est(big.trials) <= 0.6 * 600 + 1e-6, `the chosen count must fit 60% of the bound (est ${est(big.trials).toFixed(1)} s)`);
  assert(est(big.trials + 1) > 0.6 * 600 - 1e-6, 'the chosen count must be the LARGEST that fits');
  const huge = chooseAutoTrials({ ...base, t1Ms: 3000, tFullMs: 60000, mutants: 2000 });
  assert(huge.trials === 50, `start-up cost alone over target still floors at minTrials: ${JSON.stringify(huge)}`);
  assert(chooseAutoTrials({ ...base, fullTrials: 50, tFullMs: 60000, mutants: 2000 }).trials === null, 'a floor already at minTrials is never budgeted');
  assert(chooseAutoTrials({ ...base, boundS: 0, tFullMs: 60000, mutants: 2000 }).trials === null, 'an unbounded run is never budgeted');
});

test('AB4 autoTrialBudgetConfig: absent / disabled / env=0 mean off; malformed values refuse loudly', () => {
  assert(autoTrialBudgetConfig(null) === null && autoTrialBudgetConfig({}) === null, 'absent = off');
  const good = { autoTrialBudget: { enabled: true, minTrials: 50, targetFraction: 0.6, screenFactor: 15, screenMutants: 600 } };
  assert(autoTrialBudgetConfig({ autoTrialBudget: { ...good.autoTrialBudget, enabled: false } }) === null, 'enabled false = off');
  assert(autoTrialBudgetConfig(good, { MUTATION_TIER_AUTO_BUDGET: '0' }) === null, 'env 0 = off for one run');
  assert(autoTrialBudgetConfig(good, {}).minTrials === 50, 'a good block resolves');
  for (const bad of [{ minTrials: 0 }, { targetFraction: 1.5 }, { targetFraction: 0 }, { screenFactor: 0.5 }, { screenMutants: -3 }]) {
    let threw = null;
    try { autoTrialBudgetConfig({ autoTrialBudget: { ...good.autoTrialBudget, ...bad } }, {}); } catch (e) { threw = e; }
    assert(threw && /autoTrialBudget\./.test(threw.message), `${JSON.stringify(bad)} must refuse loudly`);
  }
});

function trialsScratch(source) {
  const root = mkdtempSync(join(tmpdir(), 'rmt-trials-'));
  cleanup.push(root);
  const rel = 'chaingraph/kernels/__proptests__/k-x.proptest.mjs';
  mkdirSync(join(root, 'chaingraph', 'kernels', '__proptests__'), { recursive: true });
  writeFileSync(join(root, rel), source);
  return { root, rel };
}
const AUTO_ON = { autoTrialBudget: { enabled: true, minTrials: 50, targetFraction: 0.6, screenFactor: 15, screenMutants: 600 } };
const quiet = () => {};
// Default dry run: the art-584 shape measured 11-25 (607 mutants, 4243 ms instrumented).
const DRY_584 = () => ({ ok: true, mutants: 607, netMs: 4243 });
const callResolve = (s, tierConfig, timeRun, dryRun = DRY_584) => resolveTrialsEnv({ id: 'k-x', scratchRoot: s.root, proptestRelPath: s.rel, tierConfig, repoRoot: s.root, boundS: 600, concurrency: 2, remainingS: 600, log: quiet, timeRun, dryRun });

test('AB5 resolveTrialsEnv: an explicit sibling hooks the plain floor in the sandbox and never measures', () => {
  const s = trialsScratch(PLAIN_FLOOR);
  let measured = 0;
  const env = callResolve(s, { ...AUTO_ON, mutationTrials: { 'k-x': 50 } }, () => { measured++; return { ok: true, timedOut: false, ms: 1 }; });
  assert(env.MUTATION_TIER_NUM_RUNS === '50', `sibling budget must pass through: ${JSON.stringify(env)}`);
  assert(measured === 0, 'an explicit sibling must never trigger the auto measurement');
  assert(readFileSync(join(s.root, s.rel), 'utf8').includes('MUTATION-TRIALS-AUTO-BUDGET-1 sandbox-only hook'), 'the sandbox floor must be hooked so the sibling takes effect');
});

test('AB6 resolveTrialsEnv: auto off leaves the sandbox floor byte-identical; a kernel the screen clears never pays for a dry run', () => {
  const a = trialsScratch(PLAIN_FLOOR);
  const off = callResolve(a, {}, () => { throw new Error('must not measure'); }, () => { throw new Error('must not dry-run'); });
  assert(JSON.stringify(off) === '{}' && readFileSync(join(a.root, a.rel), 'utf8') === PLAIN_FLOOR, 'auto off = no env, no sandbox write');
  let dry = 0;
  // raw 0.1 s x 15 x 600 / 2 = 450 s <= 600 s: screened out.
  const fit = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, (_r, _p, n) => ({ ok: true, timedOut: false, ms: n === 1 ? 50 : 100 }), () => { dry++; return DRY_584(); });
  assert(JSON.stringify(fit) === '{}' && dry === 0, `a screened-out kernel gets no env and no dry run: ${JSON.stringify(fit)} dry=${dry}`);
  // Screen fails (raw 0.45 s), dry run says it fits: 300 mutants x 1.5 s / 2 = 225 s.
  const fits2 = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, (_r, _p, n) => ({ ok: true, timedOut: false, ms: n === 1 ? 60 : 450 }), () => ({ ok: true, mutants: 300, netMs: 1500 }));
  assert(JSON.stringify(fits2) === '{}', `a dry-run estimate inside the bound keeps full trials: ${JSON.stringify(fits2)}`);
  // Screen fails and the dry run is unavailable: no budget (never worse than today).
  const nodry = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, (_r, _p, n) => ({ ok: true, timedOut: false, ms: n === 1 ? 60 : 450 }), () => ({ ok: false }));
  assert(JSON.stringify(nodry) === '{}', 'no dry-run measurement = no budget');
});

test('AB7 resolveTrialsEnv: the measured art-584 shape is capped; a count the unmutated floor fails at doubles until it passes', () => {
  const raw = (passFrom) => (_r, _p, n) => (n === 1 ? { ok: true, timedOut: false, ms: 60 } : n === null ? { ok: true, timedOut: false, ms: 450 } : { ok: n >= passFrom, timedOut: false, ms: 50 });
  const env = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, raw(0));
  const n = Number(env.MUTATION_TIER_NUM_RUNS);
  // 607 x 4.243 / 2 = 1288 s > 600: budget; 4000-trial floor scaled by the 9.4x instrumented ratio.
  assert(n >= 50 && n < 4000, `art-584 shape must be capped, got ${JSON.stringify(env)}`);
  const env2 = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, raw(Math.max(n * 2, 200)));
  assert(Number(env2.MUTATION_TIER_NUM_RUNS) >= Math.max(n * 2, 200), `a failing count must double until the unmutated floor passes: ${JSON.stringify(env2)}`);
  const none = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, raw(Infinity));
  assert(JSON.stringify(none) === '{}', 'a floor that only passes at full trials gets no budget');
  const broken = callResolve(trialsScratch(PLAIN_FLOOR), AUTO_ON, () => ({ ok: false, timedOut: false, ms: 10 }));
  assert(JSON.stringify(broken) === '{}', 'a floor that fails unmutated gets no budget (Stryker reports it)');
});

test('AB10 resolveTrialsEnv: a floor whose time does not shrink with TRIALS is halved to minTrials and warned, never left at the model pick', () => {
  const logs = [];
  const seen = [];
  // Fixed-cost floor: 400 ms raw at ANY trial count (the art-584 shape: other loops dominate).
  const env = resolveTrialsEnv({ id: 'k-x', scratchRoot: trialsScratch(PLAIN_FLOOR).root, proptestRelPath: 'chaingraph/kernels/__proptests__/k-x.proptest.mjs', tierConfig: AUTO_ON, repoRoot: tmpdir(), boundS: 600, concurrency: 2, remainingS: 600, log: (l) => logs.push(l),
    timeRun: (_r, _p, n) => { seen.push(n); return n === 1 ? { ok: true, timedOut: false, ms: 60 } : { ok: true, timedOut: false, ms: n === null ? 450 : 400 }; }, dryRun: DRY_584 });
  assert(env.MUTATION_TIER_NUM_RUNS === '50', `must halve down to minTrials: ${JSON.stringify(env)} calls ${JSON.stringify(seen)}`);
  assert(logs.some((l) => /WARNING: still predicted/.test(l)), `must warn that fixed costs remain: ${logs.join(' | ')}`);
});

test('AB9 parseDryRunLog reads Stryker 8.7.1 dryRunOnly lines (ANSI included) and refuses partial logs', () => {
  const log = '\x1b[32m21:49:24 (40268) INFO Instrumenter\x1b[39m Instrumented 1 source file(s) with 607 mutant(s)\n\x1b[32m21:49:29 (40268) INFO DryRunExecutor\x1b[39m Initial test run succeeded. Ran 1 tests in 4 seconds (net 4243 ms, overhead 1 ms).\n';
  const p = parseDryRunLog(log);
  assert(p.ok && p.mutants === 607 && p.netMs === 4243, `got ${JSON.stringify(p)}`);
  assert(!parseDryRunLog('Instrumented 1 source file(s) with 607 mutant(s)').ok, 'no dry-run line = not ok');
  assert(!parseDryRunLog('').ok, 'empty = not ok');
});

test('AB8 the live config block resolves and most estate floors have the shape the hook expects', () => {
  const live = loadConfig();
  const a = autoTrialBudgetConfig(live, {});
  assert(a && a.minTrials === 50 && a.targetFraction > 0 && a.targetFraction <= 1, `live autoTrialBudget must resolve: ${JSON.stringify(a)}`);
  const dir = join(fileURLToPathLocal(new URL('..', import.meta.url)), 'chaingraph', 'kernels', '__proptests__');
  const counts = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.proptest.mjs'))) {
    const st = sandboxTrialsHook(readFileSync(join(dir, f), 'utf8')).status;
    counts[st] = (counts[st] || 0) + 1;
  }
  assert((counts.patched || 0) > 500, `expected most estate floors hookable, got ${JSON.stringify(counts)}`);
  console.log(`      estate floor shapes: ${JSON.stringify(counts)}`);
});

console.log(`\nrun-mutation-tier controls: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);