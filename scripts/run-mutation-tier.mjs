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
import { classifyKernelSource, tierReport } from '../chaingraph/kernels/mutation-tier-split.mjs';

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
  const opts = { kernels: null, all: false, jsonOut: null, concurrency: 2, timeoutMs: 15000, shardIndex: null, shardCount: null };
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

// ── per-kernel scratch build + run ───────────────────────────────────────
// MUTATION-TIER-PBTCOMMON-FIX-1: this only copied chaingraph/kernels/_*.mjs (the kernel-side
// shared helpers: _hash.mjs, _head.mjs, etc.) — never chaingraph/kernels/__proptests__/_*.mjs,
// the FLOOR-side shared helper `_pbt-common.mjs` (summarize/mulberry32/pick/findShapeViolations/
// FIXTURES_DIR) that 50 of 635 proptests import via `./_pbt-common.mjs`. Any of those 50, once
// touched, hard-failed this gate with ERR_MODULE_NOT_FOUND inside Stryker's sandbox — a scratch
// wiring gap, not a kernel/proptest defect (SO #34: the fix belongs in the copier, not in every
// consuming proptest). Discovered building art-655-publish-market-mark-head (DERIV-WF-HEAD-1),
// the first PR to touch a `_pbt-common.mjs`-importing kernel since this gate went live.
function ensureSharedLibsCopied(scratchKernelsDir) {
  if (existsSync(path.join(scratchKernelsDir, '_hash.mjs'))) return; // already primed this process
  mkdirSync(scratchKernelsDir, { recursive: true });
  for (const f of readdirSync(KERNELS_DIR)) {
    if (f.startsWith('_') && f.endsWith('.mjs')) {
      cpSync(path.join(KERNELS_DIR, f), path.join(scratchKernelsDir, f));
    }
  }
  const scratchProptestsDir = path.join(scratchKernelsDir, '__proptests__');
  mkdirSync(scratchProptestsDir, { recursive: true });
  for (const f of readdirSync(PROPTESTS_DIR)) {
    if (f.startsWith('_') && f.endsWith('.mjs')) {
      cpSync(path.join(PROPTESTS_DIR, f), path.join(scratchProptestsDir, f));
    }
  }
}

// __proptests__/_*.mjs shared helpers (e.g. _pbt-common.mjs, imported by 50+ proptest floors
// via a relative './_pbt-common.mjs' specifier) never got copied into the sandbox — only the
// top-level chaingraph/kernels/_*.mjs helpers did (above). Any kernel whose proptest imports
// one threw ERR_MODULE_NOT_FOUND on its first mutation-tier run, mistested as a kernel defect.
// Same copy-underscore-helpers shape as ensureSharedLibsCopied, scoped to __proptests__/.
function ensureSharedProptestLibsCopied(scratchProptestsDir) {
  mkdirSync(scratchProptestsDir, { recursive: true });
  for (const f of readdirSync(PROPTESTS_DIR)) {
    if (f.startsWith('_') && f.endsWith('.mjs')) {
      const dest = path.join(scratchProptestsDir, f);
      if (!existsSync(dest)) cpSync(path.join(PROPTESTS_DIR, f), dest);
    }
  }
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

  const scratchKernelsDir = path.join(scratchRoot, 'chaingraph', 'kernels');
  ensureSharedLibsCopied(scratchKernelsDir);
  const scratchProptestsDir = path.join(scratchKernelsDir, '__proptests__');
  ensureSharedProptestLibsCopied(scratchProptestsDir);
  mkdirSync(path.join(scratchKernelsDir, 'fixtures'), { recursive: true });
  cpSync(kernelPath, path.join(scratchKernelsDir, kernelFile));
  cpSync(proptestPath, path.join(scratchProptestsDir, proptestFile));
  cpSync(fixturesPath, path.join(scratchKernelsDir, 'fixtures', fixturesFile));

  const reportPath = path.join(scratchRoot, 'reports', id, 'mutation-report.json');
  const kernelRelPath = `chaingraph/kernels/${kernelFile}`;
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
  return { id, runtimeMs, tiers };
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
    const pePass = pe.score === null || pe.score >= config.peripheralBreakFloor;
    const peEnforced = config.peripheralGateMode === 'enforced';
    const namedLead = (config.namedLeads || {})[id];
    console.log(`  money-math:  ${mm.score ?? 'N/A'}% (killed ${mm.killed}/${mm.total})  floor=${config.moneyMathBreakFloor}%  ${mmPass ? 'PASS' : 'FAIL'}`);
    console.log(`  peripheral:  ${pe.score ?? 'N/A'}% (killed ${pe.killed}/${pe.total})  floor=${config.peripheralBreakFloor}%  ${pePass ? 'PASS' : `FAIL${peEnforced ? '' : ' (advisory — not gating)'}`}`);
    if (r.tiers.other.total > 0) console.log(`  ⚠ ${r.tiers.other.total} mutant(s) in an unrecognised location — treated as a hard fail`);
    console.log(`  runtime: ${(r.runtimeMs / 1000).toFixed(1)}s`);
    const belowFloor = !mmPass || (peEnforced && !pePass);
    if (belowFloor && namedLead) {
      console.log(`  ⚠ NAMED LEAD (SO #36) — below floor but documented, NOT gating: ${namedLead}`);
    } else if (belowFloor || r.tiers.other.total > 0) {
      floorFailCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`examined: ${toRun.length}  hard-fail: ${hardFailCount}  floor-fail: ${floorFailCount}  named-exceptions: ${skipped.length}`);
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
