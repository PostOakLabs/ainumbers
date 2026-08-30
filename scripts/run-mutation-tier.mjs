#!/usr/bin/env node
/**
 * scripts/run-mutation-tier.mjs — MUTATION-TIERED-ROLLOUT-1.
 *
 * Generalizes FV-STRYKER-PILOT-1 (board/done/FV-STRYKER-PILOT-1.md,
 * research/FV-STRYKER-PILOT-1-REPORT.md) from a 10-kernel one-off pilot into
 * risk-tiered, config-driven, repeatable mutation testing over the kernel
 * estate. SAME command-runner-mode Stryker shape the pilot proved out
 * (mutate: [one kernel file], testRunner: 'command', one proptest process
 * invocation per mutant, scratch copy OUTSIDE repo/, shared `_*.mjs` helpers
 * copied for import resolution but NEVER mutated) — extended, never
 * restarted from scratch, with three things the pilot didn't have:
 *
 *   1. StrykerJS is fetched EPHEMERALLY via `npx --yes --package=...`, the
 *      same shape scripts/jsdoc-checkjs-gate.mjs already uses for tsc — no
 *      npm install, no package.json/node_modules committed anywhere in
 *      repo/ (SO #10 untouched; CI-only tooling that never lands in the
 *      committed tree is not a runtime dependency, per zizmor.yml's own
 *      header comment making the identical argument for its Rust binary).
 *   2. Each kernel's mutants are split money-math vs peripheral
 *      (chaingraph/kernels/mutation-tier-split.mjs) instead of one blended
 *      score — the pilot's own report identified the blended number as
 *      confounded by structurally-uncoverable buildArtifact()/meta code.
 *   3. Break floors are read from chaingraph/kernels/mutation-tiers.config.json
 *      (SO #41 — thresholds live in config, not a hardcoded number here),
 *      with TWO distinct non-blocking categories, both config-declared, never
 *      inferred: `excludedKernels` (the classifier cannot split this file at
 *      all — e.g. art-594's non-canonical export shape — so it is never run)
 *      and `namedLeads` (the kernel WAS run and scored, sits genuinely below
 *      its tier floor, and is documented rather than silently lowering the
 *      floor to fit it — SO #36's "kernel whose floor is unreachable in this
 *      row = named lead", never a silent threshold change).
 *
 * Usage:
 *   node scripts/run-mutation-tier.mjs --kernel <id> [<id> ...]
 *       Scoped run over the given kernel id(s) — this is the PR-incremental
 *       gate's mode (preflight.mjs passes it exactly the touched kernel ids,
 *       same TOUCHED_KERNEL_IDS scoping every other per-kernel gate already
 *       uses). Zero ids given after filtering out excluded ones is a
 *       same-process no-op, exit 0.
 *
 *   node scripts/run-mutation-tier.mjs --all
 *       Full-estate scan: every chaingraph/kernels/*.kernel.mjs id, minus
 *       mutation-tiers.config.json's excludedKernels. This is the scheduled
 *       nightly workflow's mode — NOT run on every PR (too slow; see the
 *       row's own "PR-side incremental gate only" instruction).
 *
 *   Common flags:
 *     --json <path>       also write the full structured summary as JSON
 *                          (never inside repo/ — the caller is responsible
 *                          for pointing this at a scratch/CI path)
 *     --concurrency <n>    Stryker concurrency (default 2, matches pilot)
 *     --timeout-ms <n>     per-mutant command timeout (default 15000, matches pilot)
 *     --decomposed         MUTATION-DECOMPOSED-SCORE-1: after each kernel's
 *                          as-shipped run, run the SAME floor a second time
 *                          with the fixture oracle short-circuited (audit
 *                          EXP-D shape: proptest-oracle-vacuity audit
 *                          §3 EXP-D — run 2 identical except runFixtureOracle()
 *                          short-circuited), and report the money-math tier's
 *                          `fixtureKills` (killed as-shipped only) vs
 *                          `propertyKills` (killed in BOTH runs — the kills
 *                          that survive fixture-leg neutralization)
 *                          separately. Gating reads ONLY propertyKills (the
 *                          blended sum is what let 0/110 property-content
 *                          kills read as 53.64%); whether that decomposed gate
 *                          blocks is `mutation-tiers.config.json`'s
 *                          `decomposedGateMode`, and its floor is
 *                          `propertyKillsBreakFloor`. Doubles per-kernel
 *                          runtime — the scheduled nightly does NOT pass this
 *                          flag (the full-estate scan already overruns the
 *                          6-hour hosted-runner ceiling; a doubled ceiling-blowout
 *                          is not a measurement, see the workflow's own header).
 *     --shard <i> <n>      with --all only: process every kernel id whose
 *                          position (0-indexed) in the sorted full id list
 *                          satisfies `i % n === index`. Used by
 *                          .github/workflows/mutation-full-scheduled.yml to
 *                          fan the ~633-kernel full-estate scan out across N
 *                          parallel matrix jobs — a single-job serial run
 *                          extrapolates to ~11-12 hours (pilot measured
 *                          ~67s/kernel average), past GitHub Actions' 6-hour
 *                          hosted-runner ceiling.
 *
 * Exit 0 — every examined kernel's money-math tier meets its break floor (and
 *          peripheral tier too, if mutation-tiers.config.json's
 *          peripheralGateMode is "enforced"), or is a named exception.
 * Exit 1 — any examined kernel is below a floor it is not excepted from, OR
 *          any kernel's Stryker run did not produce a parseable report (SO
 *          #34c: absence of a result is never treated as a pass).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyKernelSource, tierReport, tierOfMutant, scanBalanced } from '../chaingraph/kernels/mutation-tier-split.mjs';
import { checkSandboxComplete, deriveSandboxFiles } from './lib-sandbox-deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const KERNELS_DIR = path.join(REPO, 'chaingraph', 'kernels');
const PROPTESTS_DIR = path.join(KERNELS_DIR, '__proptests__');
const FIXTURES_DIR = path.join(KERNELS_DIR, 'fixtures');
const CONFIG_PATH = path.join(KERNELS_DIR, 'mutation-tiers.config.json');

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

// ── CLI parsing ───────────────────────────────────────────────────────────
function parseArgv(argv) {
  const opts = { kernels: null, all: false, jsonOut: null, concurrency: 2, timeoutMs: 15000, shardIndex: null, shardCount: null, decomposed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--kernel') {
      opts.kernels = opts.kernels || [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) { opts.kernels.push(argv[++i]); }
    } else if (a === '--json') opts.jsonOut = argv[++i];
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--shard') { opts.shardIndex = Number(argv[++i]); opts.shardCount = Number(argv[++i]); }
    else if (a === '--timeout-ms') opts.timeoutMs = Number(argv[++i]);
    else if (a === '--decomposed') opts.decomposed = true;
  }
  return opts;
}

function allKernelIds() {
  return readdirSync(KERNELS_DIR)
    .filter((f) => f.endsWith('.kernel.mjs'))
    .map((f) => f.replace(/\.kernel\.mjs$/, ''))
    .sort();
}

// ── ephemeral Stryker invocation — SAME win32 npx-cli.js-direct fix
//    scripts/jsdoc-checkjs-gate.mjs already carries (npx.cmd + shell:true on
//    win32 reopens a shell-metacharacter class; running npx's own npx-cli.js
//    through `node` directly is a normal execve, no shell, on every platform)
function resolveWindowsNpxInvocation() {
  const npxCliJs = path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  if (existsSync(npxCliJs)) return { cmd: process.execPath, prefixArgs: [npxCliJs] };
  return { cmd: 'npx.cmd', prefixArgs: [] };
}

function runStryker(configPath, cwd, strykerVersion) {
  const { cmd, prefixArgs } = process.platform === 'win32'
    ? resolveWindowsNpxInvocation()
    : { cmd: 'npx', prefixArgs: [] };
  try {
    execFileSync(
      cmd,
      [...prefixArgs, '--yes', `--package=@stryker-mutator/core@${strykerVersion}`, 'stryker', 'run', configPath],
      { cwd, stdio: 'inherit' },
    );
    return { crashed: false };
  } catch (e) {
    // Stryker's OWN exit code reflects ITS unset/default threshold, not ours — we compute
    // pass/fail from the tiered report ourselves below. A non-zero status with a status
    // code present is Stryker reporting mutants-survived, expected; a thrown error with NO
    // status (spawn failure — npx unreachable, network down, bad flags) is NOT expected
    // and must not be treated as "ran, mutants survived".
    if (e.status === undefined) return { crashed: true, error: String(e && e.message || e) };
    return { crashed: false };
  }
}

// ── decomposed scoring (MUTATION-DECOMPOSED-SCORE-1) ─────────────────────
// The audit's EXP-D control (0xAlpha/audits/2026-08-23-proptest-oracle-vacuity-audit.md)
// ran one kernel's floor twice through the SAME Stryker invocation this script
// uses: run 1 floor as-shipped; run 2 identical except `runFixtureOracle()`
// short-circuited. Per-mutant diff of the two reports separates kill-power into
// the fixture leg (killed as-shipped only) and the property layer (killed in
// BOTH runs). This section reuses that EXACT shape — one insertion into the
// SANDBOX copy of the floor's fixture-oracle entry point, never a tracked byte,
// never a second neutralization mechanism.

const ORACLE_OBJECT_SHORT_CIRCUIT =
  'return { total: 0, failures: [] }; /* MUTATION-DECOMPOSED-SCORE-1 fixture-leg neutralization (audit EXP-D shape; _pbt-common runFixtureOracle call contract is { total, failures }) */';

const RUN_FIXTURE_ORACLE_DECL_RE =
  /(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s+runFixtureOracle\s*\(/;
const PBT_COMMON_IMPORT_RE =
  /import\s*\{[^}]*\brunFixtureOracle\b[^}]*\}\s*from\s*['"]\.\/_pbt-common\.mjs['"]/;

/**
 * shortCircuitFixtureOracle — neutralize the fixture leg of a floor's
 * `runFixtureOracle` in a SANDBOX copy of its source.
 *
 * variant 'object' (the shared _pbt-common.mjs helper; callers read
 * `{ total, failures }`): insert an always-pass empty-oracle return of that
 * SAME shape as the first body statement — the helper has no side effects to
 * preserve.
 *
 * variant 'boolean' (per-proptest local declarations, callers read a truthy
 * `oracleOk`): a naive first-statement `return true` was measured BROKEN on
 * 2026-08-29 (5/5 live floors): the estate's generated floors populate
 * `results.fixture_oracle` INSIDE runFixtureOracle and their final summary
 * reads it back (`fixture_oracle_total: results.fixture_oracle.total`), so
 * skipping the body crashes the neutralized floor before any mutant runs.
 * The neutralization therefore WRAPS the declaration instead: the original
 * body runs VERBATIM (side effects intact, real diff still computed and
 * reported by the floor's own summary) and only the VERDICT is neutralized —
 * an object-shaped result reports zero failures, anything else reports true.
 * The wrapper mirrors the declaration's async-ness so awaited and plain calls
 * keep their contracts. THE ESTATE ASSUMPTION this relies on: floors exit at
 * top level, never from inside the oracle body (the generator shape, measured
 * across the live floors above) — a floor that exited inside its oracle body
 * would report fixtureKills=0 falsely and must be fixed at the floor.
 *
 * Returns the patched source, or null when no declaration is found (the
 * caller must surface that as a NAMED condition — never a silently guessed 0).
 *
 * @param {string} source
 * @param {'boolean'|'object'} [variant]
 * @returns {string | null}
 */
export function shortCircuitFixtureOracle(source, variant = 'boolean') {
  const m = RUN_FIXTURE_ORACLE_DECL_RE.exec(source);
  if (!m) return null;
  const parenIdx = m.index + m[0].length - 1; // index of the '(' just matched
  const parenEnd = scanBalanced(source, parenIdx); // survives param defaults containing parens (e.g. wrapPP = (pp) => pp)
  if (parenEnd === -1) return null;
  const brace = source.indexOf('{', parenEnd + 1);
  if (brace === -1) return null;
  const bodyEnd = scanBalanced(source, brace);
  if (bodyEnd === -1) return null;
  if (variant === 'object') {
    return source.slice(0, brace + 1) + '\n  ' + ORACLE_OBJECT_SHORT_CIRCUIT + source.slice(brace + 1);
  }

  // boolean variant — verdict-neutralizing wrapper (see JSDoc above).
  const declStart = m.index + (m[0][0] === '\n' ? 1 : 0);
  const indent = /^[ \t]*/.exec(m[0].slice(m[0][0] === '\n' ? 1 : 0))[0];
  const isAsync = /\basync\b/.test(m[0]);
  const RENAMED = '__mtds1_orig_runFixtureOracle';
  const FUNC_DECL = 'function runFixtureOracle';
  const renameIdx = source.indexOf(FUNC_DECL, declStart);
  if (renameIdx === -1 || renameIdx > parenIdx) return null;
  let out = source.slice(0, renameIdx) + `function ${RENAMED}` + source.slice(renameIdx + FUNC_DECL.length);
  const shiftedBodyEnd = bodyEnd + (RENAMED.length + 'function '.length - FUNC_DECL.length);
  const aw = isAsync ? 'await ' : '';
  const wrapper =
    `\n${indent}${isAsync ? 'async ' : ''}function runFixtureOracle(...__mtds1_args) { /* MUTATION-DECOMPOSED-SCORE-1 fixture-leg neutralization (EXP-D verdict short-circuit; original body runs verbatim below, only the verdict is neutralized) */` +
    `\n${indent}  const __mtds1_result = ${aw}${RENAMED}(...__mtds1_args);` +
    `\n${indent}  if (__mtds1_result && typeof __mtds1_result === 'object') return { ...__mtds1_result, failures: [] };` +
    `\n${indent}  return true;` +
    `\n${indent}}`;
  return out.slice(0, shiftedBodyEnd + 1) + wrapper + out.slice(shiftedBodyEnd + 1);
}

/**
 * neutralizationTargets — given a proptest's source, decide WHAT gets the
 * short-circuit: its own local `runFixtureOracle` declaration ('boolean'
 * variant), or the shared `_pbt-common.mjs` helper it imports ('object'
 * variant). Returns null when the floor exposes neither — the caller must
 * treat that as a NAMED hard failure for the kernel, never a guessed score.
 *
 * @param {string} proptestSource
 * @returns {{ patchProptest: boolean, patchCommon: boolean } | null}
 */
export function neutralizationTargets(proptestSource) {
  if (RUN_FIXTURE_ORACLE_DECL_RE.test(proptestSource)) return { patchProptest: true, patchCommon: false };
  if (PBT_COMMON_IMPORT_RE.test(proptestSource)) return { patchProptest: false, patchCommon: true };
  return null;
}

/**
 * killedMoneyMathIds — the Set of mutant ids Stryker marked `Killed` that
 * belong to the money-math tier (tierOfMutant, same classification tierReport
 * uses). Status `Killed` ONLY — the same definition scoreOf()'s `killed` count
 * uses, so fixtureKills + propertyKills always sum to the as-shipped killed
 * count exactly.
 *
 * @param {object} report — parsed Stryker mutation-report.json
 * @param {string} kernelFileRelPath
 * @param {Array<[number,number]>} peripheralRanges
 * @returns {Set<string>}
 */
function killedMoneyMathIds(report, kernelFileRelPath, peripheralRanges) {
  const ids = new Set();
  const files = report?.files || {};
  for (const [filePath, data] of Object.entries(files)) {
    for (const m of data.mutants || []) {
      if (tierOfMutant(m, filePath, kernelFileRelPath, peripheralRanges) !== 'moneyMath') continue;
      if (m.status === 'Killed' && typeof m.id === 'string') ids.add(m.id);
    }
  }
  return ids;
}

/**
 * decomposeMoneyMath — the EXP-D per-mutant diff over TWO Stryker reports of
 * the SAME kernel (same sandbox mutant set; only the fixture-oracle entry
 * point differs). Definitions (audit EXP-D verbatim):
 *   propertyKills = killed in BOTH runs (survive fixture-leg neutralization)
 *   fixtureKills  = killed as-shipped ONLY (the fixture leg's contribution)
 *   run2OnlyKills = killed neutralized-only — should be 0; a non-zero count
 *                   means the two runs are not clean subsets of each other
 *                   (determinism noise) and is REPORTED, never silently
 *                   summed into either leg.
 * propertyRatio expresses propertyKills over the tier's TOTAL mutants (the
 * same denominator as the blended score), so the two numbers are comparable.
 *
 * @param {object} reportAsShipped
 * @param {object} reportNeutralized
 * @param {string} kernelFileRelPath
 * @param {Array<[number,number]>} peripheralRanges
 */
export function decomposeMoneyMath(reportAsShipped, reportNeutralized, kernelFileRelPath, peripheralRanges) {
  const asShipped = tierReport(reportAsShipped, kernelFileRelPath, peripheralRanges).moneyMath;
  const killed1 = killedMoneyMathIds(reportAsShipped, kernelFileRelPath, peripheralRanges);
  const killed2 = killedMoneyMathIds(reportNeutralized, kernelFileRelPath, peripheralRanges);
  let fixtureKills = 0;
  for (const id of killed1) if (!killed2.has(id)) fixtureKills++;
  let run2OnlyKills = 0;
  for (const id of killed2) if (!killed1.has(id)) run2OnlyKills++;
  let propertyKills = 0;
  for (const id of killed2) if (killed1.has(id)) propertyKills++;
  const total = asShipped.total;
  const propertyRatio = total > 0 ? Number(((100 * propertyKills) / total).toFixed(1)) : null;
  return { total, killedAsShipped: asShipped.killed, propertyKills, fixtureKills, run2OnlyKills, propertyRatio };
}

/**
 * decomposedGateDecision — THE gate verdict over a decomposed result. Reads
 * ONLY the property leg; the blended as-shipped score is never consulted
 * here (that blend is what let 0/110 property-content kills read as 53.64%).
 * A decomposed result that could not be produced (neutralized run crashed, no
 * report, unparseable) is the distinct non-pass NULL — never a pass (SO #34c),
 * mirroring the peripheral null fix in this row.
 *
 * @param {{ error?: string, propertyRatio: number | null } | null} dec
 * @param {{ propertyKillsBreakFloor: number }} config
 * @returns {'PASS'|'FAIL'|'NULL'}
 */
export function decomposedGateDecision(dec, config) {
  if (!dec || dec.error || dec.propertyRatio === null || dec.propertyRatio === undefined) return 'NULL';
  return dec.propertyRatio >= config.propertyKillsBreakFloor ? 'PASS' : 'FAIL';
}

// ── per-kernel scratch build + run ───────────────────────────────────────
// MUTATION-TIER-PBTCOMMON-FIX-1 fixed a scratch wiring gap (chaingraph/kernels/__proptests__/
// _pbt-common.mjs, imported by 50+ proptest floors, never got copied — only the top-level
// chaingraph/kernels/_*.mjs helpers did) by adding a SECOND glob scoped to __proptests__/. That
// is the same shape as the bug it fixed, not a different one: both scope by filename CONVENTION
// (starts with `_`) rather than by what the copied kernel/proptest pair actually imports. It
// looks derived and is not — a shared helper introduced without the `_` prefix, or a proptest
// that starts importing a non-underscore sibling, breaks the same way the pilot's ERR_MODULE_NOT_FOUND
// did (see run-mutation-tier.test.mjs for the reproduced break, SANDBOX-FILELIST-SWEEP-2).
//
// deriveSandboxFiles() (scripts/lib-sandbox-deps.mjs, SANDBOX-FILELIST-GATE-1) walks the REAL
// relative-import closure of the kernel + proptest pair instead, so the copied set is correct by
// construction rather than by naming convention, and throws a NAMED error — never a bare
// ERR_MODULE_NOT_FOUND — for anything it cannot resolve. checkSandboxComplete() then verifies the
// tree actually written to scratch, independent of the derivation that built it (STANDING-ORDERS
// #34 — a gate may not read the value it validates from the artifact under test).
//
// Both kernels and proptests are pure compute + property-test modules with no `node <script>`
// shell-out anywhere in their closure (measured: zero execFileSync/execSync/spawnSync hits across
// chaingraph/kernels/*.{kernel,proptest}.mjs and chaingraph/kernels/_*.mjs, chaingraph/kernels/
// __proptests__/_*.mjs) — so there is no second edge for this harness to miss.
// `repoRoot` defaults to the real repository and is overridable only so
// run-mutation-tier.test.mjs can drive this against a throwaway fixture repo
// instead of writing synthetic kernels into the real chaingraph/kernels/.
export function copySandboxDeps(kernelRelPath, proptestRelPath, fixturesRelPath, scratchRoot, repoRoot = REPO) {
  const files = deriveSandboxFiles({ roots: [kernelRelPath, proptestRelPath], extras: [fixturesRelPath], repoRoot });
  for (const rel of files) {
    const dest = path.join(scratchRoot, rel);
    if (existsSync(dest)) continue; // already primed by an earlier kernel this process
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(path.join(repoRoot, rel), dest);
  }
  const problem = checkSandboxComplete(scratchRoot, files);
  if (problem) throw new Error(problem);
  return files;
}

function runOneKernel(id, scratchRoot, opts, strykerVersion) {
  const kernelFile = `${id}.kernel.mjs`;
  const proptestFile = `${id}.proptest.mjs`;
  const fixturesFile = `${id}.fixtures.json`;
  const kernelPath = path.join(KERNELS_DIR, kernelFile);
  const proptestPath = path.join(PROPTESTS_DIR, proptestFile);
  const fixturesPath = path.join(FIXTURES_DIR, fixturesFile);

  if (!existsSync(kernelPath)) return { id, hardFail: `no such kernel file: ${kernelFile}` };
  if (!existsSync(proptestPath)) return { id, hardFail: `no proptest floor: __proptests__/${proptestFile}` };
  if (!existsSync(fixturesPath)) return { id, hardFail: `no fixtures file: fixtures/${fixturesFile}` };

  const source = readFileSync(kernelPath, 'utf8');
  const { hasCanonicalShape, peripheralRanges } = classifyKernelSource(source);
  if (!hasCanonicalShape) {
    return { id, hardFail: 'non-canonical kernel shape (no `export function buildArtifact` found) — add it to excludedKernels in mutation-tiers.config.json instead of running it unsplit' };
  }

  const kernelRelPath = `chaingraph/kernels/${kernelFile}`;
  const proptestRelPath = `chaingraph/kernels/__proptests__/${proptestFile}`;
  const fixturesRelPath = `chaingraph/kernels/fixtures/${fixturesFile}`;
  try {
    copySandboxDeps(kernelRelPath, proptestRelPath, fixturesRelPath, scratchRoot);
  } catch (e) {
    return { id, hardFail: e.message };
  }

  const reportPath = path.join(scratchRoot, 'reports', id, 'mutation-report.json');
  const config = {
    mutate: [kernelRelPath],
    testRunner: 'command',
    commandRunner: { command: `node chaingraph/kernels/__proptests__/${proptestFile}` },
    reporters: ['json'],
    jsonReporter: { fileName: reportPath },
    timeoutMS: opts.timeoutMs,
    concurrency: opts.concurrency,
    tempDirName: path.join(scratchRoot, '.stryker-tmp', id),
  };
  const configPath = path.join(scratchRoot, `stryker.${id}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const t0 = Date.now();
  const { crashed, error } = runStryker(configPath, scratchRoot, strykerVersion);
  const runtimeMs = Date.now() - t0;
  if (crashed) return { id, hardFail: `stryker did not run to completion: ${error}` };

  if (!existsSync(reportPath)) return { id, hardFail: 'stryker produced no report.json — SO #34c: absence is not a pass' };
  let report;
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); }
  catch (e) { return { id, hardFail: `report.json unparseable: ${e.message}` }; }

  const tiers = tierReport(report, kernelRelPath, peripheralRanges);

  // ── decomposed (fixture-leg-neutralized) second run — MUTATION-DECOMPOSED-SCORE-1 ──
  // The patch lands ONLY on scratch copies (the proptest, or the shared
  // _pbt-common.mjs helper it imports runFixtureOracle from) and is RESTORED in
  // the finally block below — the shared scratchRoot primes _pbt-common.mjs once
  // per process ("already primed by an earlier kernel"), so a patch left behind
  // would silently fixture-neutralize every LATER kernel's as-shipped run too.
  let decomposed = null;
  if (opts.decomposed) {
    const proptestScratchPath = path.join(scratchRoot, proptestRelPath);
    const commonScratchRelPath = 'chaingraph/kernels/__proptests__/_pbt-common.mjs';
    const commonScratchPath = path.join(scratchRoot, commonScratchRelPath);
    const targets = neutralizationTargets(readFileSync(proptestScratchPath, 'utf8'));
    if (!targets) {
      // Audit §2 (proptest-oracle-vacuity): a minority of floors carry NO fixture leg at
      // all — there is nothing to neutralize and a second run would be byte-identical to
      // the first. Report the trivial decomposition honestly (fixtureKills = 0 BY
      // CONSTRUCTION, propertyRatio = the as-shipped score) instead of a named hard fail
      // or a wasted duplicate Stryker run.
      decomposed = { fixtureLegAbsent: true, ...decomposeMoneyMath(report, report, kernelRelPath, peripheralRanges), runtimeMs: 0 };
    } else {
      const patched = [];
    try {
      if (targets.patchCommon) {
        const commonOriginal = readFileSync(commonScratchPath, 'utf8');
        const commonPatched = shortCircuitFixtureOracle(commonOriginal, 'object');
        if (commonPatched === null) {
          return { id, hardFail: 'decomposed: runFixtureOracle declaration not found in the sandbox copy of _pbt-common.mjs (unexpected — the proptest imports it from there)' };
        }
        writeFileSync(commonScratchPath, commonPatched);
        patched.push([commonScratchPath, commonOriginal]);
      } else {
        const proptestOriginal = readFileSync(proptestScratchPath, 'utf8');
        const proptestPatched = shortCircuitFixtureOracle(proptestOriginal, 'boolean');
        if (proptestPatched === null) {
          return { id, hardFail: 'decomposed: runFixtureOracle declaration not found in the sandbox copy of __proptests__/' + proptestFile + ' (unexpected — neutralizationTargets just matched it)' };
        }
        writeFileSync(proptestScratchPath, proptestPatched);
        patched.push([proptestScratchPath, proptestOriginal]);
      }

      const report2Path = path.join(scratchRoot, 'reports', id, 'mutation-report.nofixture.json');
      const config2 = {
        mutate: [kernelRelPath],
        testRunner: 'command',
        commandRunner: { command: `node chaingraph/kernels/__proptests__/${proptestFile}` },
        reporters: ['json'],
        jsonReporter: { fileName: report2Path },
        timeoutMS: opts.timeoutMs,
        concurrency: opts.concurrency,
        tempDirName: path.join(scratchRoot, '.stryker-tmp', `${id}-nofixture`),
      };
      const config2Path = path.join(scratchRoot, `stryker.${id}.nofixture.json`);
      writeFileSync(config2Path, JSON.stringify(config2, null, 2));

      const t1 = Date.now();
      const run2 = runStryker(config2Path, scratchRoot, strykerVersion);
      const runtime2Ms = Date.now() - t1;
      if (run2.crashed) {
        decomposed = { error: `fixture-neutralized stryker run did not run to completion: ${run2.error}`, runtimeMs: runtime2Ms };
      } else if (!existsSync(report2Path)) {
        decomposed = { error: 'fixture-neutralized stryker run produced no report.json — SO #34c: absence is not a pass', runtimeMs: runtime2Ms };
      } else {
        let report2;
        try { report2 = JSON.parse(readFileSync(report2Path, 'utf8')); }
        catch (e) {
          decomposed = { error: `fixture-neutralized report.json unparseable: ${e.message}`, runtimeMs: runtime2Ms };
        }
        if (!decomposed) {
          decomposed = { ...decomposeMoneyMath(report, report2, kernelRelPath, peripheralRanges), runtimeMs: runtime2Ms };
        }
      }
    } finally {
      for (const [p, original] of patched) writeFileSync(p, original);
    }
    }
  }

  return { id, runtimeMs, tiers, decomposed };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const config = loadConfig();
  const excluded = config.excludedKernels || {};

  let ids;
  if (opts.all) {
    ids = allKernelIds();
    if (opts.shardCount != null) {
      if (!(opts.shardCount > 0) || !(opts.shardIndex >= 0 && opts.shardIndex < opts.shardCount)) {
        console.error(`run-mutation-tier: invalid --shard ${opts.shardIndex} ${opts.shardCount} (index must be 0 <= index < count).`);
        process.exit(1);
      }
      ids = ids.filter((_, i) => i % opts.shardCount === opts.shardIndex);
      console.log(`run-mutation-tier: --all --shard ${opts.shardIndex} ${opts.shardCount} selects ${ids.length} of ${allKernelIds().length} kernel id(s).`);
    }
  }
  else if (opts.kernels && opts.kernels.length) ids = opts.kernels;
  else { console.log('run-mutation-tier: no --kernel id(s) and no --all given — nothing to do (exit 0).'); process.exit(0); }

  const toRun = [];
  const skipped = [];
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(excluded, id)) skipped.push({ id, reason: excluded[id] });
    else toRun.push(id);
  }

  if (toRun.length === 0) {
    console.log(`run-mutation-tier: ${skipped.length} id(s) given, all are named exceptions — nothing to run (exit 0).`);
    for (const s of skipped) console.log(`  SKIP (named exception) ${s.id}: ${s.reason}`);
    process.exit(0);
  }

  // SO #55: session-private scratch — a fixed shared root rmSync EPERM'd against an
  // orphaned peer-session run (ASSEMBLE-LAND-WITHHELD-0829-1 BLOCKED diagnosis).
  const scratchRoot = path.join(os.tmpdir(), `ain-mutation-tier-${process.pid}`);
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(scratchRoot, { recursive: true });

  console.log(`run-mutation-tier: running ${toRun.length} kernel(s) (${skipped.length} named exception(s) skipped), scratch=${scratchRoot}`);

  const results = [];
  let hardFailCount = 0;
  let floorFailCount = 0;
  let decomposedNullCount = 0;
  for (const id of toRun) {
    console.log(`\n=== ${id} ===`);
    const r = runOneKernel(id, scratchRoot, opts, config.strykerVersion);
    results.push(r);
    if (r.hardFail) {
      hardFailCount++;
      console.error(`  ✗ HARD FAIL: ${r.hardFail}`);
      continue;
    }
    const mm = r.tiers.moneyMath;
    const pe = r.tiers.peripheral;
    const mmPass = mm.score !== null && mm.score >= config.moneyMathBreakFloor;
    // MUTATION-DECOMPOSED-SCORE-1 — NULL ≠ PASS (SO #34c). The pre-fix logic OR-ed the
    // peripheral score against the floor in a way that treated a NULL score as PASS.
    // A null score is "the checker could not run", never "the checker passed";
    // it is a distinct non-pass state that gates in enforced mode.
    const pePass = pe.score !== null && pe.score >= config.peripheralBreakFloor;
    const peEnforced = config.peripheralGateMode === 'enforced';
    const namedLead = (config.namedLeads || {})[id];
    console.log(`  money-math:  ${mm.score ?? 'N/A'}% (killed ${mm.killed}/${mm.total})  floor=${config.moneyMathBreakFloor}%  ${mmPass ? 'PASS' : 'FAIL'}`);
    if (pe.score === null) {
      console.log(`  peripheral:  NULL — the checker could not produce a score (SO #34c) — non-pass${peEnforced ? '' : ' (advisory — not gating)'}`);
    } else {
      console.log(`  peripheral:  ${pe.score}% (killed ${pe.killed}/${pe.total})  floor=${config.peripheralBreakFloor}%  ${pePass ? 'PASS' : `FAIL${peEnforced ? '' : ' (advisory — not gating)'}`}`);
    }
    if (r.tiers.other.total > 0) console.log(`  ⚠ ${r.tiers.other.total} mutant(s) in an unrecognised location — treated as a hard fail`);
    console.log(`  runtime: ${(r.runtimeMs / 1000).toFixed(1)}s`);
    // ── decomposed reporting + gate (MUTATION-DECOMPOSED-SCORE-1, shipped 2026-08-29) ──
    // The decomposed gate decision reads ONLY propertyKills (via decomposedGateDecision);
    // the blended as-shipped score is never consulted for it. As of 2026-08-29 the config
    // (chaingraph/kernels/mutation-tiers.config.json) ships decomposedGateMode='advisory'
    // with propertyKillsBreakFloor=0 (measured 6-kernel basis recorded in that config), so
    // the verdict printed below never gates and the as-shipped blended floors keep gating
    // unchanged. Wherever this stands today, read that config's decomposedGateMode key:
    // once a future row sets it to 'enforced' there, the branch below ADDS the propertyKills
    // gate on top of the existing floors (floors only tighten — SO #41 ratchet).
    let decGateFail = false;
    if (r.decomposed) {
      const dec = r.decomposed;
      const decEnforced = config.decomposedGateMode === 'enforced';
      const decState = decomposedGateDecision(dec, config);
      if (decState === 'NULL') {
        decomposedNullCount++;
        console.log(`  decomposed:  NULL — ${dec.error || 'no decomposed result'} — non-pass${decEnforced ? '' : ' (advisory — not gating)'}`);
        decGateFail = true;
      } else {
        const fixtureShare = dec.killedAsShipped > 0 ? Number(((100 * dec.fixtureKills) / dec.killedAsShipped).toFixed(1)) : 0;
        const absentNote = dec.fixtureLegAbsent ? '  [no fixture leg — property-only floor, fixtureKills=0 by construction]' : '';
        console.log(`  decomposed:  property ${dec.propertyRatio}% (killed ${dec.propertyKills}/${dec.total})  fixture-leg ${dec.fixtureKills} kill(s) (${fixtureShare}% of as-shipped kills)  floor=${config.propertyKillsBreakFloor}%  ${decState === 'PASS' ? 'PASS' : `FAIL${decEnforced ? '' : ' (advisory — not gating)'}`}${absentNote}`);
        if (dec.run2OnlyKills > 0) {
          console.log(`  ⚠ ${dec.run2OnlyKills} mutant(s) killed ONLY in the fixture-neutralized run — the two runs are not clean subsets (determinism noise); the decomposition is reported, never summed into either leg`);
        }
        decGateFail = decState !== 'PASS';
      }
      console.log(`  decomposed-runtime: ${((dec.runtimeMs || 0) / 1000).toFixed(1)}s`);
    }
    const belowFloor = !mmPass || (peEnforced && !pePass) || (config.decomposedGateMode === 'enforced' && decGateFail);
    if (belowFloor && namedLead) {
      console.log(`  ⚠ NAMED LEAD (SO #36) — below floor but documented, NOT gating: ${namedLead}`);
    } else if (belowFloor || r.tiers.other.total > 0) {
      floorFailCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`examined: ${toRun.length}  hard-fail: ${hardFailCount}  floor-fail: ${floorFailCount}  named-exceptions: ${skipped.length}${opts.decomposed ? `  decomposed-null: ${decomposedNullCount}` : ''}`);
  for (const s of skipped) console.log(`  SKIP (named exception) ${s.id}: ${s.reason}`);

  if (opts.jsonOut) {
    writeFileSync(opts.jsonOut, JSON.stringify({ config, results, skipped }, null, 2) + '\n');
    console.log(`wrote JSON summary to ${opts.jsonOut}`);
  }

  if (hardFailCount > 0 || floorFailCount > 0) {
    console.error(`\n✗ run-mutation-tier FAILED — ${hardFailCount} hard failure(s), ${floorFailCount} floor failure(s) of ${toRun.length} examined.`);
    process.exit(1);
  }
  console.log('\n✓ run-mutation-tier PASSED — every examined kernel met its tier floor(s) or is a named exception.');
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) await main();
