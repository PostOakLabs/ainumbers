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
 *   4. RCA01-MUTATION-TIER-COST-1: a third config-declared category,
 *      `mutateSurfaceSplits` — a NAMED detmath-aware mutate-surface split.
 *      For a kernel that carries the GENERATED fdlibm detmath block behind
 *      explicit BEGIN/END deterministic-transcendental-math markers, the
 *      config may name the block's line range; the tier then disables
 *      mutation across that range on the SANDBOX COPY ONLY (Stryker's own
 *      `Stryker disable all` / `Stryker restore` directive comments, appended
 *      to the marker lines — zero tracked kernel bytes change, zero line
 *      shift), scoring the kernel's own authored logic instead of a
 *      detmath-dominated population that cannot finish inside the default
 *      bound. The config entry is re-verified against the kernel's markers on
 *      every run and fails loudly on drift; see resolveSurfaceSplit().
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
 * Per-kernel wall-clock bound (MUTATION-TIER-HANG-MMS03-PNR01-1):
 *     Every kernel's Stryker run(s) share one deadline, default 600 s (10 min)
 *     per kernel. MUTATION-TIER-CONFIG-BOUND-1 made the bound config-declared
 *     (SO #41 — thresholds live in config): per kernel it resolves as
 *     env `MUTATION_TIER_KERNEL_TIMEOUT_S=<positive integer seconds>` (global
 *     override, invalid values fail the run loudly, never silently unbounded)
 *     > `mutation-tiers.config.json` `kernelTimeoutSeconds[<kernel id>]` (a
 *     positive integer; anything else fails loudly naming the kernel and the
 *     bad value; first entry: pnr-01 = 9000 s per the PNR01 row's stated
 *     bound) > the 600 s default (unchanged for every kernel config does not
 *     name). On expiry the Stryker process TREE is killed (Windows:
 *     `taskkill /PID <npx> /T /F`; POSIX: SIGKILL the detached process group)
 *     and the kernel is a HARD FAIL printing
 *       `MUTATION-TIER TIMEOUT <kernel> after <s>s — treat as FAIL, see
 *        MUTATION-TIER-HANG-MMS03-PNR01-1`
 *     — a hang must become a red gate with a name, never a silent multi-hour
 *     wait (measured: mms-03 = 564 mutants × ~26 s/mutant ≈ 2 h; pnr-01 =
 *     1,668 mutants × ~5 min/mutant ≈ days; both silent, since the json
 *     reporter prints nothing during the mutant phase).
 *
 * Exit 0 — every examined kernel's money-math tier meets its break floor (and
 *          peripheral tier too, if mutation-tiers.config.json's
 *          peripheralGateMode is "enforced"), or is a named exception.
 * Exit 1 — any examined kernel is below a floor it is not excepted from, OR
 *          any kernel's Stryker run did not produce a parseable report (SO
 *          #34c: absence of a result is never treated as a pass), OR any
 *          kernel hit its per-kernel wall-clock bound.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyKernelSource, tierReport, tierOfMutant, scanBalanced } from '../chaingraph/kernels/mutation-tier-split.mjs';
import { checkSandboxComplete, deriveSandboxFiles } from './lib-sandbox-deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

function loadConfig(repoRoot = REPO) {
  return JSON.parse(readFileSync(path.join(repoRoot, 'chaingraph', 'kernels', 'mutation-tiers.config.json'), 'utf8'));
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

function allKernelIds(repoRoot = REPO) {
  const kernelsDir = path.join(repoRoot, 'chaingraph', 'kernels');
  return readdirSync(kernelsDir)
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

// ── per-kernel wall-clock bound (MUTATION-TIER-HANG-MMS03-PNR01-1) ────────
// Default 600 s (10 min) per kernel, env-overridable. Rationale lives in the
// file header. Parse failure is a LOUD config error, never a silently
// unbounded run (SO #34c — "no bound" must be a decision someone typed, not a
// typo's side effect).
const DEFAULT_KERNEL_TIMEOUT_S = 600;
export function kernelTimeoutSecondsFromEnv(env = process.env) {
  const raw = env.MUTATION_TIER_KERNEL_TIMEOUT_S;
  if (raw === undefined || raw === '') return DEFAULT_KERNEL_TIMEOUT_S;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`MUTATION_TIER_KERNEL_TIMEOUT_S must be a positive integer number of seconds, got "${raw}"`);
  }
  return n;
}

// MUTATION-TIER-CONFIG-BOUND-1: the bound is now CONFIG-DECLARED per kernel
// (SO #41 — thresholds live in mutation-tiers.config.json's
// `kernelTimeoutSeconds` section) and resolved, per kernel, as:
//   1. env MUTATION_TIER_KERNEL_TIMEOUT_S — global override, semantics
//      unchanged (kernelTimeoutSecondsFromEnv verbatim: positive integer or
//      LOUD failure);
//   2. config kernelTimeoutSeconds[id] — must be a positive integer number of
//      seconds; anything else fails LOUDLY naming the kernel, the config
//      section and the bad value, never a silent fallback to the default;
//   3. DEFAULT_KERNEL_TIMEOUT_S (600 s) — unchanged for every kernel config
//      does not name (mms-03 and others keep the default until their own rows
//      state otherwise).
// The env path delegates to kernelTimeoutSecondsFromEnv so the override's
// parse/accept/reject semantics cannot drift between the two entry points.
export function kernelTimeoutSecondsForKernel(id, env = process.env, config = null) {
  const raw = env.MUTATION_TIER_KERNEL_TIMEOUT_S;
  if (raw !== undefined && raw !== '') return kernelTimeoutSecondsFromEnv(env);
  const bounds = (config && config.kernelTimeoutSeconds) || {};
  if (Object.prototype.hasOwnProperty.call(bounds, id)) {
    const v = bounds[id];
    if (!Number.isInteger(v) || v <= 0) {
      throw new Error(`mutation-tiers.config.json kernelTimeoutSeconds["${id}"] must be a positive integer number of seconds, got ${JSON.stringify(v)}`);
    }
    return v;
  }
  return DEFAULT_KERNEL_TIMEOUT_S;
}

export function timeoutMessage(id, elapsedS) {
  return `MUTATION-TIER TIMEOUT ${id} after ${elapsedS}s — treat as FAIL, see MUTATION-TIER-HANG-MMS03-PNR01-1`;
}

// Kill the whole process tree rooted at pid. On Windows `taskkill /T /F` walks
// the parent-child tree (tier -> npx node -> stryker -> test-runner nodes).
// On POSIX the child was spawned detached (its own process group), so a single
// negative-pid SIGKILL reaches every descendant.
function killProcessTree(pid) {
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); }
    catch { /* fall through to the direct-child kill below */ }
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* not a group leader any more */ }
  }
}

// KILL_GRACE_MS: if the tree kill somehow does not produce a `close` event
// (a stuck grandchild holding the direct child's handle), fail LOUD anyway
// after this grace instead of hanging again — the bound must never be able to
// become the same silent wait it exists to prevent.
const KILL_GRACE_MS = 15000;

/**
 * runProcessBounded — spawn `cmd args` (stdio inherited), enforce a wall-clock
 * budget, and on expiry kill the whole process tree. Separated from runStryker
 * so the bound's semantics are unit-drivable without fetching Stryker (the
 * sleeping-child control in run-mutation-tier.test.mjs).
 *
 * `crashed` keeps the exact pre-bound semantics callers rely on: true ONLY for
 * a spawn-level failure (npx unreachable, bad flags). Stryker's own non-zero
 * exit is NOT a crash — it reflects Stryker's default threshold, and the tier
 * computes pass/fail from the report itself.
 *
 * @returns {Promise<{ crashed: boolean, error: string | null, timedOut: boolean,
 *                     killConfirmed: boolean, elapsedS: number }>}
 */
export function runProcessBounded({ cmd, args, cwd, budgetS }) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    let timedOut = false;
    let killConfirmed = true;
    let spawnError = null;
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', detached: process.platform !== 'win32' });
    const killGrace = setTimeout(() => {
      // The tree kill did not close the child within grace — stop waiting (the
      // direct child may leak; the verdict is still the loud FAIL).
      killConfirmed = false;
      finish();
    }, budgetS > 0 ? budgetS * 1000 + KILL_GRACE_MS : KILL_GRACE_MS);
    let budgetTimer = null;
    if (budgetS > 0 && Number.isFinite(budgetS)) {
      budgetTimer = setTimeout(() => { timedOut = true; killProcessTree(child.pid); try { child.kill('SIGKILL'); } catch { /* already gone */ } }, budgetS * 1000);
    }
    child.on('error', (e) => { spawnError = e; });
    child.on('close', finish);
    function finish() {
      if (settled) return;
      settled = true;
      // Both timers MUST die with the child: an armed budget timer would keep
      // the tier's event loop (and the pre-push hook) alive for up to the full
      // budget after the last kernel finished — the same silent-wait defect in
      // a smaller dress.
      if (budgetTimer) clearTimeout(budgetTimer);
      clearTimeout(killGrace);
      resolve({ crashed: spawnError !== null, error: spawnError ? String(spawnError.message || spawnError) : null, timedOut, killConfirmed, elapsedS: Math.round((Date.now() - t0) / 1000) });
    }
  });
}

function runStryker(configPath, cwd, strykerVersion, budgetS) {
  const { cmd, prefixArgs } = process.platform === 'win32'
    ? resolveWindowsNpxInvocation()
    : { cmd: 'npx', prefixArgs: [] };
  return runProcessBounded({
    cmd,
    args: [...prefixArgs, '--yes', `--package=@stryker-mutator/core@${strykerVersion}`, 'stryker', 'run', configPath],
    cwd,
    budgetS,
  });
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

// ── named mutate-surface split (RCA01-MUTATION-TIER-COST-1) ──────────────
// The DETMATH-SWAP batch-B kernels (see mutation-tiers.config.json namedLeads:
// ml-02, qfa-02, rca-02, qfa-01, pnr-01, sim-01) inline the GENERATED fdlibm
// detmath block behind explicit BEGIN/END marker comments, and that block's
// algorithm-internal coefficient/guard-branch mutants are structurally
// unreachable from compute()-level behavioral floors while dominating the
// instrumented population — for rca-01 the 1,401-mutant population made the
// tier unable to finish inside the default 600 s bound at all (measured
// MUTATION-TIER TIMEOUT on origin/main AND the PR branch). A config-declared
// split (`mutateSurfaceSplits`) lets the tier score a NAMED kernel's own
// authored logic by disabling mutation across the marker-delimited block in
// the SANDBOX COPY ONLY:
//   * zero tracked kernel bytes change — the directives are appended to the
//     sandbox copy after copySandboxDeps; the real kernel file is never
//     written (a kernel edit would force a re-prove);
//   * the exclusion is NAMED in mutation-tiers.config.json — kernel id, the
//     exact BEGIN/END line range and the reason — never a silent ignore;
//   * the config's recorded range is re-resolved from the kernel's own
//     markers on EVERY run and must match, or the run fails LOUDLY naming
//     both numbers (stale config rots loudly; it never silently widens or
//     shrinks the excluded surface — SO #34c);
//   * behavior is unchanged — the directives are comments. The unmutated
//     sandbox kernel the floor executes is byte-identical except for them,
//     and Stryker's instrumented dry run proves that on every run.

const DETMATH_BEGIN_RE = /^\s*\/\*\s*===== BEGIN deterministic transcendental math\b/;
const DETMATH_END_RE = /^\s*\/\*\s*===== END deterministic transcendental math\b/;

/**
 * findDetmathMarkerRange — resolve the kernel's BEGIN/END
 * deterministic-transcendental-math marker pair as a 1-indexed inclusive
 * [startLine, endLine], or null when either marker is absent (the caller must
 * fail loudly, never guess a range).
 * @param {string} source
 * @returns {[number, number] | null}
 */
export function findDetmathMarkerRange(source) {
  const lines = source.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1) {
      if (DETMATH_BEGIN_RE.test(lines[i])) start = i + 1;
    } else if (DETMATH_END_RE.test(lines[i])) {
      return [start, i + 1];
    }
  }
  return null;
}

/**
 * surfaceSplitPatch — append StrykerJS's own documented disable/restore
 * directive pair (`// Stryker disable all[: reason]` … `// Stryker restore`,
 * stryker-mutator.io "Ignore mutations") to the given 1-indexed inclusive
 * ranges' boundary lines. The boundaries are the kernel's pure block-comment
 * marker lines — no code, no mutants of their own — so appending keeps every
 * line number stable and classifyKernelSource ranges computed on the ORIGINAL
 * source stay valid for the patched sandbox copy. The original file's EOL
 * convention is preserved.
 * @param {string} source
 * @param {Array<[number, number]>} excludedRanges
 * @returns {string}
 */
export function surfaceSplitPatch(source, excludedRanges) {
  const lines = source.split(/\r?\n/);
  for (const [start, end] of excludedRanges) {
    if (!(start >= 1 && end >= start && end <= lines.length)) {
      throw new Error(`surfaceSplitPatch: excluded range [${start}, ${end}] is outside the ${lines.length}-line source`);
    }
    lines[start - 1] += ' // Stryker disable all: named detmath surface split (mutation-tiers.config.json mutateSurfaceSplits; RCA01-MUTATION-TIER-COST-1) — sandbox copy only, tracked kernel bytes unchanged';
    // Stryker 8.7.1's directive grammar REQUIRES the mutator list on restore too
    // (instrumenter's strykerCommentDirectiveRegex: `Stryker (disable|restore)( (next-line))? ([a-zA-Z, ]+)[:reason]`)
    // — a bare `// Stryker restore` never matches and leaves every later mutant
    // ignored (measured: the first split run came back 1401/1401 Ignored).
    lines[end - 1] += ' // Stryker restore all';
  }
  return lines.join(source.includes('\r\n') ? '\r\n' : '\n');
}

/**
 * resolveSurfaceSplit — read mutation-tiers.config.json's `mutateSurfaceSplits`
 * entry for one kernel and verify it against the kernel's own markers.
 * Returns null when the config names no split for the kernel (the default for
 * every kernel — the tier behaves exactly as before this section). Throws
 * LOUDLY when an entry is malformed, names a kernel that carries no markers
 * at all (a named exclusion that names nothing is a config error, not a
 * no-op), or whose recorded ranges do not EXACTLY match the marker-resolved
 * range (stale config; update the config to the marker-resolved numbers).
 * @param {string} kernelId
 * @param {object | null} tierConfig — parsed mutation-tiers.config.json
 * @param {string} source — the kernel's source text
 * @returns {{ excludedRanges: Array<[number, number]>, reason: string } | null}
 */
export function resolveSurfaceSplit(kernelId, tierConfig, source) {
  const splits = (tierConfig && tierConfig.mutateSurfaceSplits) || {};
  if (!Object.prototype.hasOwnProperty.call(splits, kernelId)) return null;
  const entry = splits[kernelId];
  const configured = entry && entry.excludedRanges;
  const rangeOk = (r) => Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 1 && r[1] >= r[0];
  if (!Array.isArray(configured) || configured.length === 0 || !configured.every(rangeOk)) {
    throw new Error(`mutation-tiers.config.json mutateSurfaceSplits["${kernelId}"] must carry a non-empty excludedRanges array of [startLine, endLine] integer pairs, got ${JSON.stringify(configured)}`);
  }
  const markers = findDetmathMarkerRange(source);
  if (!markers) {
    throw new Error(`mutation-tiers.config.json mutateSurfaceSplits names kernel "${kernelId}" but its source carries no BEGIN/END deterministic-transcendental-math markers — the named exclusion names nothing (stale config; fix the config or the kernel, never guess)`);
  }
  for (const [s, e] of configured) {
    if (s !== markers[0] || e !== markers[1]) {
      throw new Error(`mutation-tiers.config.json mutateSurfaceSplits["${kernelId}"] excludedRanges ${JSON.stringify(configured)} do not match the kernel's own BEGIN/END deterministic-transcendental-math markers at lines ${markers[0]}-${markers[1]} — stale config; update the config to the marker-resolved range`);
    }
  }
  return { excludedRanges: configured.map((r) => [r[0], r[1]]), reason: typeof entry.reason === 'string' ? entry.reason : '' };
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

// `repoRoot` defaults to the real repository and is overridable only so
// run-mutation-tier.test.mjs and the row controls can drive this against a
// throwaway fixture repo instead of writing synthetic kernels into the real
// chaingraph/kernels/. `opts.kernelTimeoutS` (MUTATION-TIER-HANG-MMS03-PNR01-1)
// is the kernel's WHOLE wall-clock budget: both the as-shipped run and the
// decomposed second run draw down one deadline set when the kernel starts, so
// a decomposed run can never double the wall clock past the bound.
export async function runOneKernel(id, scratchRoot, opts, strykerVersion, repoRoot = REPO, tierConfig = null) {
  const kernelsDir = path.join(repoRoot, 'chaingraph', 'kernels');
  const proptestsDir = path.join(kernelsDir, '__proptests__');
  const fixturesDir = path.join(kernelsDir, 'fixtures');
  const kernelFile = `${id}.kernel.mjs`;
  const proptestFile = `${id}.proptest.mjs`;
  const fixturesFile = `${id}.fixtures.json`;
  const kernelPath = path.join(kernelsDir, kernelFile);
  const proptestPath = path.join(proptestsDir, proptestFile);
  const fixturesPath = path.join(fixturesDir, fixturesFile);

  if (!existsSync(kernelPath)) return { id, hardFail: `no such kernel file: ${kernelFile}` };
  if (!existsSync(proptestPath)) return { id, hardFail: `no proptest floor: __proptests__/${proptestFile}` };
  if (!existsSync(fixturesPath)) return { id, hardFail: `no fixtures file: fixtures/${fixturesFile}` };

  const source = readFileSync(kernelPath, 'utf8');
  const { hasCanonicalShape, peripheralRanges } = classifyKernelSource(source);
  if (!hasCanonicalShape) {
    return { id, hardFail: 'non-canonical kernel shape (no `export function buildArtifact` found) — add it to excludedKernels in mutation-tiers.config.json instead of running it unsplit' };
  }

  // RCA01-MUTATION-TIER-COST-1: a config-named mutate-surface split (verified
  // against the kernel's own BEGIN/END markers) shrinks the instrumented
  // population to the kernel's own authored logic. A malformed or stale entry
  // is a hard fail HERE, before any sandbox work.
  let surfaceSplit = null;
  try {
    surfaceSplit = resolveSurfaceSplit(id, tierConfig, source);
  } catch (e) {
    return { id, hardFail: e.message };
  }

  const kernelRelPath = `chaingraph/kernels/${kernelFile}`;
  const proptestRelPath = `chaingraph/kernels/__proptests__/${proptestFile}`;
  const fixturesRelPath = `chaingraph/kernels/fixtures/${fixturesFile}`;
  try {
    copySandboxDeps(kernelRelPath, proptestRelPath, fixturesRelPath, scratchRoot, repoRoot);
  } catch (e) {
    return { id, hardFail: e.message };
  }

  // The split's directives land ONLY on the sandbox copy (see the section
  // comment above): the real kernel file is never written, and the patch
  // persists for the kernel's whole budget so a decomposed second run sees
  // the same instrumented surface as the as-shipped first run.
  if (surfaceSplit) {
    const sandboxKernelPath = path.join(scratchRoot, kernelRelPath);
    writeFileSync(sandboxKernelPath, surfaceSplitPatch(readFileSync(sandboxKernelPath, 'utf8'), surfaceSplit.excludedRanges));
    const rangeText = surfaceSplit.excludedRanges.map(([s, e]) => `${s}-${e}`).join(', ');
    console.log(`  mutate-surface split (named in mutation-tiers.config.json mutateSurfaceSplits): sandbox copy only — mutation disabled across the deterministic-transcendental-math block, lines ${rangeText}; tracked kernel bytes untouched`);
  }

  // MUTATION-TIER-HANG-MMS03-PNR01-1: one wall-clock deadline for the WHOLE
  // kernel (as-shipped run + decomposed second run draws it down together).
  const deadlineMs = opts.kernelTimeoutS > 0 ? Date.now() + opts.kernelTimeoutS * 1000 : null;
  const budgetS = () => deadlineMs ? Math.max(1, Math.ceil((deadlineMs - Date.now()) / 1000)) : 0;

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
  const { crashed, error, timedOut, elapsedS } = await runStryker(configPath, scratchRoot, strykerVersion, budgetS());
  if (timedOut) {
    const msg = timeoutMessage(id, elapsedS);
    console.error(`  ${msg}`);
    return { id, hardFail: msg, timedOut: true, runtimeMs: elapsedS * 1000 };
  }
  if (crashed) return { id, hardFail: `stryker did not run to completion: ${error}` };
  const runtimeMs = Date.now() - t0;

  if (!existsSync(reportPath)) return { id, hardFail: 'stryker produced no report.json — SO #34c: absence is not a pass' };
  let report;
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); }
  catch (e) { return { id, hardFail: `report.json unparseable: ${e.message}` }; }

  // RCA01-MUTATION-TIER-COST-1: status `Ignored` is Stryker's marker for a
  // mutant disabled by a directive comment. Those mutants were NOT executed —
  // they are not part of the measured surface and must not sit in the score's
  // denominator — but an exclusion is only ever legal when THIS kernel's
  // config entry names it. So: Ignored mutants inside the named excluded
  // ranges are counted, printed, and dropped from the measured surface;
  // Ignored mutants anywhere else — or any Ignored mutant at all on a kernel
  // no mutateSurfaceSplits entry names — are a HARD FAIL (a silent exclusion
  // is never a pass, SO #34c). Kernels without any directive comment are
  // unaffected: no Ignored mutants, no change to any denominator.
  const ignored = [];
  for (const [filePath, data] of Object.entries(report.files || {})) {
    for (const m of data.mutants || []) {
      if (m.status === 'Ignored' && typeof m.location?.start?.line === 'number') ignored.push([filePath, m]);
    }
  }
  if (ignored.length > 0) {
    const outside = ignored.filter(([filePath, m]) => {
      if (!surfaceSplit) return true;
      if (filePath.replace(/\\/g, '/') !== kernelRelPath) return true;
      const line = m.location.start.line;
      return !surfaceSplit.excludedRanges.some(([s, e]) => line >= s && line <= e);
    });
    if (outside.length > 0) {
      return { id, hardFail: `${outside.length} report mutant(s) carry status Ignored outside the named excluded surface${surfaceSplit ? ` (mutateSurfaceSplits lines ${surfaceSplit.excludedRanges.map(([s, e]) => `${s}-${e}`).join(', ')})` : ' — no mutateSurfaceSplits entry names this kernel'} — a silent exclusion is never a pass (SO #34c); name the surface in mutation-tiers.config.json or remove the Stryker directive comment` };
    }
    for (const data of Object.values(report.files || {})) {
      data.mutants = (data.mutants || []).filter((m) => m.status !== 'Ignored');
    }
    console.log(`  mutation-surface: ${ignored.length} mutant(s) inside the named excluded range(s) are Ignored — excluded from the measured denominator (named in mutation-tiers.config.json mutateSurfaceSplits, never silent)`);
  }

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
      const run2 = await runStryker(config2Path, scratchRoot, strykerVersion, budgetS());
      const runtime2Ms = Date.now() - t1;
      if (run2.timedOut) {
        // Same loud bound as the as-shipped run, but a decomposed second-run
        // timeout is a decomposed NULL (the tier's score stands; the split
        // could not be measured) — never a silent overrun of the deadline.
        const msg = timeoutMessage(id, run2.elapsedS);
        console.error(`  ${msg}`);
        decomposed = { error: `fixture-neutralized run hit the per-kernel wall-clock bound — ${msg}`, runtimeMs: runtime2Ms };
      } else if (run2.crashed) {
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
// `repoRoot` defaults to the real repository; overridable only so the
// MUTATION-TIER-HANG-MMS03-PNR01-1 controls can drive the whole tier against
// a throwaway fixture repo (sleeping-floor kernel) without touching the real
// chaingraph/kernels/.
export async function runTier(argv, repoRoot = REPO) {
  const opts = parseArgv(argv);
  try {
    opts.kernelTimeoutS = kernelTimeoutSecondsFromEnv();
  } catch (e) {
    console.error(`run-mutation-tier: ${e.message}`);
    process.exit(1);
  }
  const config = loadConfig(repoRoot);
  const excluded = config.excludedKernels || {};

  let ids;
  if (opts.all) {
    ids = allKernelIds(repoRoot);
    if (opts.shardCount != null) {
      if (!(opts.shardCount > 0) || !(opts.shardIndex >= 0 && opts.shardIndex < opts.shardCount)) {
        console.error(`run-mutation-tier: invalid --shard ${opts.shardIndex} ${opts.shardCount} (index must be 0 <= index < count).`);
        process.exit(1);
      }
      ids = ids.filter((_, i) => i % opts.shardCount === opts.shardIndex);
      console.log(`run-mutation-tier: --all --shard ${opts.shardIndex} ${opts.shardCount} selects ${ids.length} of ${allKernelIds(repoRoot).length} kernel id(s).`);
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

  // MUTATION-TIER-CONFIG-BOUND-1: validate every examined kernel's bound
  // up-front (env > config > default) — an invalid config value fails the run
  // LOUDLY here, naming the kernel and the bad value, BEFORE any Stryker work
  // (same loud-failure shape as the env check above).
  try {
    for (const id of toRun) kernelTimeoutSecondsForKernel(id, process.env, config);
  } catch (e) {
    console.error(`run-mutation-tier: ${e.message}`);
    process.exit(1);
  }

  // SO #55: session-private scratch — a fixed shared root rmSync EPERM'd against an
  // orphaned peer-session run (ASSEMBLE-LAND-WITHHELD-0829-1 BLOCKED diagnosis).
  const scratchRoot = path.join(os.tmpdir(), `ain-mutation-tier-${process.pid}`);
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(scratchRoot, { recursive: true });

  console.log(`run-mutation-tier: running ${toRun.length} kernel(s) (${skipped.length} named exception(s) skipped), scratch=${scratchRoot}`);
  console.log(`run-mutation-tier: per-kernel wall-clock bound resolution: env MUTATION_TIER_KERNEL_TIMEOUT_S > config kernelTimeoutSeconds > default ${DEFAULT_KERNEL_TIMEOUT_S}s (on expiry the stryker tree is killed and the kernel is a HARD FAIL — MUTATION-TIER-HANG-MMS03-PNR01-1)`);

  const results = [];
  let hardFailCount = 0;
  let floorFailCount = 0;
  let decomposedNullCount = 0;
  for (const id of toRun) {
    console.log(`\n=== ${id} ===`);
    // MUTATION-TIER-CONFIG-BOUND-1: resolve THIS kernel's bound (already
    // validated up-front) and run it under that budget, not a process-wide one.
    const kernelOpts = { ...opts, kernelTimeoutS: kernelTimeoutSecondsForKernel(id, process.env, config) };
    console.log(`  per-kernel wall-clock bound: ${kernelOpts.kernelTimeoutS}s`);
    const r = await runOneKernel(id, scratchRoot, kernelOpts, config.strykerVersion, repoRoot, config);
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
if (IS_MAIN) await runTier(process.argv.slice(2));
