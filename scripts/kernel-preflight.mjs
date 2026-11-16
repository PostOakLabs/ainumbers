#!/usr/bin/env node
/**
 * scripts/kernel-preflight.mjs — KERNEL-PREFLIGHT-1.
 *
 * Every kernel-class check the estate already has (RIDER-KERNEL.md's 107-line
 * checklist + preflight.mjs's GATES list), scoped to ONE kernel, in ~1-2 minutes,
 * so a K session can run it repeatedly WHILE AUTHORING instead of discovering
 * failures in a 10-minute whole-repo preflight at push, on a red PR, or after a
 * GPU prove (Tim, 2026-08-16: "these workflows should work without issues the
 * moment they are made").
 *
 * This file WIRES existing checks — it writes no new gate logic. Every check
 * below either already had a per-kernel mode, or gained a small `--only <id>`
 * flag on the underlying script (behaviour-neutral: whole-estate run is
 * unchanged when the flag is absent). See the row's `done:` list for which
 * scripts were touched. ONE exception: check 7c (mutation wall bound) is an
 * ADVISORY estimate, not a gate — it wires run-mutation-tier.mjs's own
 * exported machinery into a short sampled run and never gates anything
 * (MUTATION-BOUND-FROM-PREFLIGHT-1).
 *
 * Usage:
 *   node scripts/kernel-preflight.mjs <art-id>            full check list
 *   node scripts/kernel-preflight.mjs <art-id> --fast      skip the GPU cycle
 *                                                           preflight outright (it
 *                                                           probes the WSL namespace
 *                                                           for the prover binaries:
 *                                                           ~0.1s while the distro is
 *                                                           up, ~15s when wsl.exe has
 *                                                           to cold-start it, which
 *                                                           is the common case since
 *                                                           the VM idles out between
 *                                                           runs)
 *   node scripts/kernel-preflight.mjs <art-id> --page-less  manual override: force the
 *                                                           page-less-shard exemption
 *                                                           (node page + hub-categories
 *                                                           checks become N-A). Normally
 *                                                           NOT needed — this is derived
 *                                                           automatically from the node's
 *                                                           own chaingraph.json/shard url
 *                                                           field (page-less class = url
 *                                                           does not point at a
 *                                                           chaingraph/art-*.html page;
 *                                                           see memory "Kernel shard row
 *                                                           ships page-less"). Use only if
 *                                                           that derivation can't yet see
 *                                                           your case (e.g. the shard file
 *                                                           doesn't exist yet).
 *   node scripts/kernel-preflight.mjs <art-id> --keep-going  run every check even
 *                                                           after one fails
 *                                                           (default: fail-fast)
 *
 * cwd: repo/ (relative paths below resolve against this file's own location,
 * so it also works run from elsewhere, but the row's convention is cwd=repo/).
 *
 * Exit 0 iff every check is READY/PASS/N-A. Exit 1 on any ✗.
 */
import { execSync, execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { loadHubCategories } from './_hub-categories.mjs';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { copySandboxDeps, surfaceSplitPatch, runProcessBounded, loadConfig } from './run-mutation-tier.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

const argv = process.argv.slice(2);
const ID = argv.find((a) => !a.startsWith('--'));
const FAST = argv.includes('--fast');
const PAGE_LESS = argv.includes('--page-less');
const KEEP_GOING = argv.includes('--keep-going');

if (!ID) {
  console.error('Usage: node scripts/kernel-preflight.mjs <art-id> [--fast] [--page-less] [--keep-going]');
  process.exit(2);
}

const KERNEL_PATH = resolve(REPO, 'chaingraph', 'kernels', `${ID}.kernel.mjs`);
if (!existsSync(KERNEL_PATH)) {
  console.error(`✗ kernel-preflight ${ID}: no chaingraph/kernels/${ID}.kernel.mjs — not a kernel id.`);
  process.exit(2);
}

const PROPTEST_PATH = resolve(REPO, 'chaingraph', 'kernels', '__proptests__', `${ID}.proptest.mjs`);
const SHARD_PATH = resolve(REPO, 'chaingraph', 'graph', 'nodes', `${ID}.json`);
const PAGE_PATH = resolve(REPO, 'chaingraph', `${ID}.html`);

function run(label, cmd, extra) {
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return { label, status: 'PASS', ms: Date.now() - t0, out, ...extra };
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    return { label, status: 'FAIL', ms: Date.now() - t0, out, ...extra };
  }
}

function na(label, reason) {
  return { label, status: 'N-A', ms: 0, note: reason };
}

/** True when relPath differs from origin/main, or is absent there (a brand-new
 * file, genuinely touched). Shared touched-scoping: the jsdoc touched-root
 * derivation (check 6) and the mutation wall bound advisory (check 7c) must
 * agree on what "touched" means, so one definition serves both. */
function differsFromOriginMain(relPath, absPath) {
  let originContent;
  try {
    originContent = execFileSync('git', ['show', `origin/main:${relPath}`], { cwd: REPO, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return true; // absent from origin/main — brand-new file, genuinely touched
  }
  return originContent !== readFileSync(absPath, 'utf8');
}

const results = [];

function record(r) {
  results.push(r);
  return r;
}

function shouldStop() {
  return !KEEP_GOING && results.some((r) => r.status === 'FAIL');
}

// 1. syntax
if (!shouldStop()) {
  record(run('Syntax (tool/kernel/chain HTML)', 'node chaingraph/kernels/syntax-check.mjs'));
}

// 2. exports
if (!shouldStop()) {
  record(run('Kernel exports (meta+compute+buildArtifact)', `node scripts/check-kernel-exports.mjs --only ${ID}`));
}

// 3. forbidden-hash lint
if (!shouldStop()) {
  record(run('Forbidden-hash lint', `node chaingraph/kernels/lint-forbidden-hash.mjs --only ${ID}`));
}

// 4. guest-builtin safety
if (!shouldStop()) {
  record(run('Guest-builtin safety (GUEST-BUILTIN-GATE-1)', `node chaingraph/kernels/check-guest-builtin-safety.mjs --only ${ID}`));
}

// 4a. caller-key lookup (KERNEL-CALLER-KEY-LOOKUP-LINT-1) — blocking for a kernel with no
// baseline entry (a newly added kernel), advisory for kernels already in the baseline.
if (!shouldStop()) {
  record(run('Caller-key lookup (KERNEL-CALLER-KEY-LOOKUP-LINT-1)', `node chaingraph/kernels/lint-caller-key-lookup.mjs --only ${ID}`));
}

// 4b. citation-in-comments (KERNEL-CITATION-CLASS-1) — kernel source is BEHAVIOUR ONLY;
// a citation belongs in node metadata (regulatory_basis/cited_clause_digest/description),
// never a kernel comment, so a wrong one is a metadata PR forever, never a re-prove.
// Scoped to new/changed kernels only inside the lint script itself — an unchanged existing
// kernel is N-A here, not a fail (RIDER-KERNEL.md SHARD-GATE-PRE-ASSEMBLE-1's own scoping
// shape, applied to this gate).
if (!shouldStop()) {
  record(run('Citation-in-comments (KERNEL-CITATION-CLASS-1)', `node chaingraph/kernels/lint-kernel-citation-comments.mjs --only ${ID}`));
}

// 5. VM<->worker parity
if (!shouldStop()) {
  record(run('VM<->worker parity (§24)', `node chaingraph/kernels/vm-parity-gate.mjs --strict --only ${ID}`));
}

// 6. tsc --checkJs (jsdoc-checkjs-gate.mjs). MUST use the SAME "touched" scoping the real
// gate uses (a genuine PR diff vs its base), never "always the target kernel" — measured
// while building this row: 606/616 kernels share a `{ now, parent_hashes = [], ... } = {}`
// buildArtifact destructuring with no default for `now`, which tsc's --checkJs flags with
// a "Property 'now' does not exist" diagnostic on ANY file it type-checks with that shape,
// regardless of whether the file was actually edited. jsdoc-checkjs-gate.mjs's own header
// already documents this as a known, accepted, permanent gap that is harmless ONLY because
// rule (1) (scope-to-touched) reclassifies it as "ignored-dependency" whenever the kernel
// itself is not part of the diff being checked — confirmed against the REAL CI run for the
// ASSEMBLE-ART628-1 PR (run 31970940656): it type-checked art-628's kernel.mjs (pulled in
// only to resolve the touched proptest file's import) and correctly logged the 'now'
// diagnostic as "[pre-existing dependency, not in this diff, ignored]", while a REAL bug
// in the touched proptest file (TS2464, computed property name) was the actual [BLOCKING]
// failure. Passing the kernel file itself as an unconditional touched root — this check's
// first version — reproduced a false FAIL on every kernel, including art-617 (the row's own
// READY fixture). The fix: only treat kernel/floor as "touched" (passed to tsc as a root)
// if they actually differ from origin/main, or don't exist there yet (a brand-new shard) —
// exactly PR-diff scoping, using origin/main as the stand-in base a live authoring session
// would otherwise diff against.
if (!shouldStop()) {
  const relKernel = `chaingraph/kernels/${ID}.kernel.mjs`;
  const relFloor = `chaingraph/kernels/__proptests__/${ID}.proptest.mjs`;
  const candidates = [relKernel, ...(existsSync(PROPTEST_PATH) ? [relFloor] : [])];

  const files = candidates.filter((rel) => differsFromOriginMain(rel, resolve(REPO, rel)));

  if (files.length === 0) {
    record(na('tsc --checkJs (jsdoc-checkjs-gate.mjs)', `${relKernel}${existsSync(PROPTEST_PATH) ? ' and its floor file' : ''} match origin/main byte-for-byte — nothing touched, nothing for CI's real PR-diff-scoped gate to check either.`));
  } else {
    // win32 npx.cmd spawnSync EINVAL is fixed inside jsdoc-checkjs-gate.mjs itself
    // (JSDOC-CHECKJS-PREFLIGHT-1, 2026-08-16 — resolves npx-cli.js and runs it through
    // `node` directly, no shell) — nothing extra needed here, same as preflight.mjs's
    // own "JSDoc CheckJS" gate calls it plainly.
    record(run('tsc --checkJs (jsdoc-checkjs-gate.mjs)', `node scripts/jsdoc-checkjs-gate.mjs ${files.join(' ')}`));
  }
}

// 7. proptest floor — run this kernel's own floor file directly (every floor file
//    imports ONLY its own sibling .kernel.mjs — run-proptests.mjs's own header
//    documents this as checked, not assumed — so running it standalone is exact).
if (!shouldStop()) {
  if (!existsSync(PROPTEST_PATH)) {
    record({ label: 'Property-testing floor', status: 'FAIL', ms: 0, out: `missing chaingraph/kernels/__proptests__/${ID}.proptest.mjs — every live kernel carries one (616/616 as of KERNEL-PREFLIGHT-1).` });
  } else {
    record(run('Property-testing floor', `node chaingraph/kernels/__proptests__/${ID}.proptest.mjs`));
  }
}

// 7a. estate ratchets (KERNEL-PREFLIGHT-RATCHETS-1). None of these three scripts takes
// `--only <id>`: each runs estate-wide against its own baseline/ceiling. READY must still
// mean "this kernel adds no new ratchet debt", so run the script as-is and judge ONLY the
// lines that name this exact kernel id. Another kernel's baselined debt never fails this
// kernel's preflight. The scripts are not re-implemented here.
const idToken = new RegExp(`(?<![A-Za-z0-9_-])${ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`);

/** Run `cmd` estate-wide; FAIL iff `pick(out)` returns lines naming ${ID}. */
function runRatchet(label, cmd, pick) {
  const r = run(label, cmd);
  if (r.status === 'PASS') return { ...r, out: `${cmd}: exit 0, ${ID} adds no new violation.` };
  const hits = pick(r.out).filter((l) => idToken.test(l));
  if (hits.length) return { ...r, out: `${ID} is named by ${cmd}:\n${hits.map((l) => l.trimEnd()).join('\n')}` };
  return { ...r, status: 'PASS', out: `${cmd} is red estate-wide but names no violation for ${ID} (other kernels' debt, not this kernel's).` };
}

// flag-mirror prints violating kernel ids, one per indented line, under the
// "raise conditional flags with NO mirrored output_payload member" header. The stale-entry
// list below it also names ids but is a baseline burn-down, not a violation, so scope to
// the violation section only.
function flagMirrorViolations(out) {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.includes('raise conditional flags with NO mirrored'));
  if (start < 0) return [];
  const section = [];
  for (const l of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(l) || /^\s+Add one of/.test(l)) break;
    section.push(l);
  }
  return section;
}

if (!shouldStop()) {
  record(runRatchet('Flag-mirror (AUTHORING-STANDARD §2)', 'node scripts/check-flag-mirror.mjs', flagMirrorViolations));
}

// R4 null-class: regressions print as "  ⛔ <kernel>: ..." lines.
if (!shouldStop()) {
  record(runRatchet('R4 null-class (MR-R4-NULL-REGRESSION-GATE-1)', 'node scripts/check-mr-r4-null-ratchet.mjs', (out) => out.split('\n').filter((l) => l.includes('⛔'))));
}

// flags-computed: failures print as indented lines after the "FAILURE(s)" header.
if (!shouldStop()) {
  record(runRatchet('Flags-computed (FLAGS-COMPUTED-LINT-1)', 'node scripts/check-flags-computed.mjs', (out) => {
    const lines = out.split('\n');
    const start = lines.findIndex((l) => /FAILURE\(s\)/.test(l));
    return start < 0 ? [] : lines.slice(start + 1).filter((l) => /^\s+\S/.test(l));
  }));
}

// 7b. floor digest stamp (FV-FLOOR-DIGEST-GATE-1) — only meaningful once the
// floor file exists; reuses check-fv-floor-coverage.mjs's own --verify-authoring
// mode, which is already scoped to exactly the files it's given.
if (!shouldStop()) {
  if (!existsSync(PROPTEST_PATH)) {
    record(na('Floor digest stamp (kernel_digest_at_authoring)', 'no floor file to check (see prior FAIL)'));
  } else {
    record(run('Floor digest stamp (kernel_digest_at_authoring)', `node scripts/check-fv-floor-coverage.mjs --verify-authoring "chaingraph/kernels/__proptests__/${ID}.proptest.mjs"`));
  }
}

// 7c. Mutation wall bound (advisory, MUTATION-BOUND-FROM-PREFLIGHT-1). For a
// TOUCHED kernel (its bytes differ from origin/main) that carries NO sibling
// <id>.mutation.json bound, estimate what one full mutation-tier run of this
// kernel would cost and, when the estimate exceeds the 600 s default bound,
// print `would-set bound N s` plus the sibling content that would carry it.
// Cure class it automates: the 2026-11 CI shards went red with
// "MUTATION-TIER TIMEOUT ... after 600s" for kernels whose honest bound
// needed a measured full run (art-783: 1787 mutants, 1377.7 s full wall) that
// nobody could know before booking the CI minute.
//
// The estimate = mutants x measured seconds per mutant x 2.3 safety. The
// per-mutant seconds come from a SHORT SAMPLED Stryker run: up to three
// 40-line windows of the SANDBOX kernel copy stay mutable via the SAME
// StrykerJS directive pair surfaceSplitPatch writes (tracked kernel bytes are
// never touched); the sampled wall over the sampled active mutants gives
// s/mutant at the tier's own concurrency, and the report's full mutant count
// (Ignored entries included) gives the population.
//
// Advisory ONLY: the sibling file is never written, and every terminal state
// below is N-A, so this step can never change this script's exit code. A
// state the step cannot measure (no npx, budget expiry, no active sample
// mutant) is printed as its own named N-A, never silently skipped (SO #34c).
// --fast skips the step outright so the authoring loop keeps its 1-2 min
// shape; run once without --fast before booking mutation-tier CI time.
// KERNEL_PREFLIGHT_MUTATION_SAMPLE_JSON={"mutantCount":n,"secondsPerMutant":x}
// injects a pre-measured sample (the selftest's surface, and any caller that
// already holds a real measured sample); production runs measure for
// themselves.
if (!shouldStop()) {
  const t0 = Date.now();
  const LABEL = 'Mutation wall bound (advisory, MUTATION-BOUND-FROM-PREFLIGHT-1)';
  const SAMPLE = {
    DEFAULT_BOUND_S: 600, // run-mutation-tier.mjs DEFAULT_KERNEL_TIMEOUT_S: the CI per-kernel bound
    SAFETY_FACTOR: 2.3,   // measured CI-vs-local drift of the mutation tier wall clock
    WINDOW_LINES: 40,     // lines per sample window
    BUDGET_S: 240,        // hard wall bound for the whole sampled run (expiry => NOT MEASURED, never a hang)
    CONCURRENCY: 2,       // run-mutation-tier.mjs's own default
    TIMEOUT_MS: 15000,    // per-mutant timeout, run-mutation-tier.mjs's own default
  };
  const siblingRel = `chaingraph/kernels/${ID}.mutation.json`;
  const advisory = (out) => record({ label: LABEL, status: 'N-A', ms: Date.now() - t0, out });
  const estimateBound = (mutantCount, secondsPerMutant) =>
    Math.round(mutantCount * secondsPerMutant * SAMPLE.SAFETY_FACTOR);

  // Up to three disjoint sample windows, centers at the quarters. Below twice
  // the window size the whole file IS the sample (no directives needed).
  // Adjacent windows keep a >= 2-line gap so the disable/restore directive
  // pairs never share a line.
  const sampleWindows = (totalLines) => {
    if (totalLines <= SAMPLE.WINDOW_LINES * 2) return [[1, totalLines]];
    const out = [];
    for (const f of [0.25, 0.5, 0.75]) {
      const s = Math.max(1, Math.round(totalLines * f) - Math.floor(SAMPLE.WINDOW_LINES / 2));
      const e = Math.min(totalLines, s + SAMPLE.WINDOW_LINES - 1);
      if (out.length && s <= out[out.length - 1][1] + 2) continue;
      out.push([s, e]);
    }
    return out;
  };
  // The disabled complement of the active windows, as surfaceSplitPatch ranges.
  const complementOf = (windows, totalLines) => {
    const out = [];
    let cursor = 1;
    for (const [s, e] of windows) {
      if (s > cursor) out.push([cursor, s - 1]);
      cursor = e + 1;
    }
    if (cursor <= totalLines) out.push([cursor, totalLines]);
    return out;
  };

  const sampleMutationRate = async (strykerVersion) => {
    const sandbox = mkdtempSync(join(tmpdir(), 'ain-kpfb-sample-'));
    try {
      copySandboxDeps(
        `chaingraph/kernels/${ID}.kernel.mjs`,
        `chaingraph/kernels/__proptests__/${ID}.proptest.mjs`,
        `chaingraph/kernels/fixtures/${ID}.fixtures.json`,
        sandbox, REPO,
      );
      const kernelPath = join(sandbox, 'chaingraph', 'kernels', `${ID}.kernel.mjs`);
      const source = readFileSync(kernelPath, 'utf8');
      const totalLines = source.split(/\r?\n/).length;
      const windows = sampleWindows(totalLines);
      const complement = complementOf(windows, totalLines);
      const patched = complement.length
        ? surfaceSplitPatch(source, complement, 'kernel-preflight mutation-wall sample (MUTATION-BOUND-FROM-PREFLIGHT-1); sandbox copy only')
        : source;
      writeFileSync(kernelPath, patched);
      const reportPath = join(sandbox, 'reports', `${ID}.sample.mutation-report.json`);
      const configPath = join(sandbox, `stryker.${ID}.sample.json`);
      writeFileSync(configPath, JSON.stringify({
        mutate: [`chaingraph/kernels/${ID}.kernel.mjs`],
        testRunner: 'command',
        commandRunner: { command: `node chaingraph/kernels/__proptests__/${ID}.proptest.mjs` },
        reporters: ['json'],
        jsonReporter: { fileName: reportPath },
        timeoutMS: SAMPLE.TIMEOUT_MS,
        concurrency: SAMPLE.CONCURRENCY,
        tempDirName: join(sandbox, '.stryker-tmp', ID),
      }, null, 2));
      // The same win32 npx-cli.js-direct invocation runStryker() uses inside
      // run-mutation-tier.mjs (npx.cmd + shell:true reopens a shell
      // metacharacter class on win32; running npx's own npx-cli.js through
      // `node` directly is a normal execve on every platform).
      const npxCliJs = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
      const inv = process.platform === 'win32'
        ? (existsSync(npxCliJs) ? { cmd: process.execPath, prefixArgs: [npxCliJs] } : { cmd: 'npx.cmd', prefixArgs: [] })
        : { cmd: 'npx', prefixArgs: [] };
      const run = await runProcessBounded({
        cmd: inv.cmd,
        args: [...inv.prefixArgs, '--yes', `--package=@stryker-mutator/core@${strykerVersion}`, 'stryker', 'run', configPath],
        cwd: sandbox,
        budgetS: SAMPLE.BUDGET_S,
      });
      if (run.timedOut) return { measured: false, why: `the sampled run exceeded its ${SAMPLE.BUDGET_S}s wall budget and was killed` };
      if (run.crashed) return { measured: false, why: `stryker could not run: ${run.error}` };
      if (!existsSync(reportPath)) return { measured: false, why: 'the sampled run produced no report (Stryker initial-test-run failure?)' };
      let report;
      try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch (e) { return { measured: false, why: `the sample report is unparseable: ${e.message}` }; }
      let totalMutants = 0;
      let sampled = 0;
      for (const f of Object.values(report.files || {})) {
        for (const m of f.mutants || []) {
          totalMutants += 1;
          if (m.status !== 'Ignored') sampled += 1;
        }
      }
      if (sampled < 1) return { measured: false, why: `the sample windows carried no active mutant across ${totalMutants} generated (all Ignored) — nothing measurable` };
      return { measured: true, totalMutants, sampled, sampledSeconds: run.elapsedS, windows: windows.length };
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  };

  // Precondition screen; each state its own named N-A.
  if (FAST) {
    advisory('skipped under --fast — the authoring loop keeps its 1-2 min shape. Run once without --fast before booking mutation-tier CI time.');
  } else if (existsSync(resolve(REPO, siblingRel))) {
    let boundNote = '';
    try { boundNote = ` (kernelTimeoutSeconds ${JSON.parse(readFileSync(resolve(REPO, siblingRel), 'utf8')).kernelTimeoutSeconds})`; } catch { /* unreadable sibling: the name alone still decides */ }
    advisory(`sibling bound present: ${siblingRel}${boundNote} — the tier already resolves its wall clock from it; nothing to estimate.`);
  } else if (!differsFromOriginMain(`chaingraph/kernels/${ID}.kernel.mjs`, KERNEL_PATH)) {
    advisory('kernel byte-identical to origin/main — untouched kernel bytes are the bytes the CI tier already measured; nothing to estimate.');
  } else {
    let tierConfig = null;
    try { tierConfig = loadConfig(REPO); } catch { /* unreadable config: the screens below pass open; the sample itself stays honest */ }
    const fixturesPath = resolve(REPO, 'chaingraph', 'kernels', 'fixtures', `${ID}.fixtures.json`);
    let decision = null;
    if (tierConfig?.excludedKernels && Object.prototype.hasOwnProperty.call(tierConfig.excludedKernels, ID)) {
      decision = advisory(`excludedKernels names ${ID} — the tier never runs this kernel, so no wall bound can be owed.`);
    } else if (tierConfig?.mutateSurfaceSplits && Object.prototype.hasOwnProperty.call(tierConfig.mutateSurfaceSplits, ID)) {
      decision = advisory(`mutateSurfaceSplits names ${ID} — a named surface split already shrinks the instrumented population, so a plain-source sample would misestimate it. Bound from your own measured run instead.`);
    } else if (!existsSync(fixturesPath)) {
      decision = advisory(`no chaingraph/kernels/fixtures/${ID}.fixtures.json — the sampled floor has no fixtures file to run against; cannot sample.`);
    }
    if (!decision) {
      let sample = null;
      const injected = process.env.KERNEL_PREFLIGHT_MUTATION_SAMPLE_JSON;
      if (injected) {
        try {
          const s = JSON.parse(injected);
          if (!(Number.isFinite(s.mutantCount) && s.mutantCount > 0) || !(Number.isFinite(s.secondsPerMutant) && s.secondsPerMutant > 0)) {
            throw new Error('mutantCount and secondsPerMutant must both be positive finite numbers');
          }
          sample = { measured: true, totalMutants: s.mutantCount, secondsPerMutant: s.secondsPerMutant, injected: true };
        } catch (e) {
          sample = { measured: false, why: `injected sample unreadable: ${e.message}` };
        }
      } else {
        console.log(`  [${LABEL}] sampling now: one bounded stryker run over three <=${SAMPLE.WINDOW_LINES}-line windows (budget ${SAMPLE.BUDGET_S}s); stryker output follows.`);
        sample = await sampleMutationRate(tierConfig?.strykerVersion || '8.7.1');
      }
      if (!sample.measured) {
        advisory(`NOT MEASURED — ${sample.why}. The advisory cannot estimate here; measure the full run detached before booking mutation-tier CI time.`);
      } else {
        const secondsPerMutant = sample.injected ? sample.secondsPerMutant : sample.sampledSeconds / sample.sampled;
        const estimateS = sample.totalMutants * secondsPerMutant * SAMPLE.SAFETY_FACTOR;
        const boundN = estimateBound(sample.totalMutants, secondsPerMutant);
        const basis = sample.injected
          ? `pre-measured sample injected via KERNEL_PREFLIGHT_MUTATION_SAMPLE_JSON (${sample.totalMutants} mutants x ${secondsPerMutant.toFixed(3)} s/mutant)`
          : `sampled ${sample.sampled} active mutant(s) across ${sample.windows} window(s) in ${sample.sampledSeconds}s at concurrency ${SAMPLE.CONCURRENCY} (${secondsPerMutant.toFixed(3)} s/mutant), ${sample.totalMutants} mutants generated in total`;
        if (estimateS > SAMPLE.DEFAULT_BOUND_S) {
          advisory([
            `would-set bound ${boundN} s`,
            `sibling ${siblingRel} would carry: ${JSON.stringify({ kernelTimeoutSeconds: boundN })}`,
            `estimate: ${sample.totalMutants} mutants x ${secondsPerMutant.toFixed(3)} s/mutant x ${SAMPLE.SAFETY_FACTOR} safety = ${estimateS.toFixed(1)} s vs the ${SAMPLE.DEFAULT_BOUND_S}s default — past it, the CI tier hard-fails at the default bound (MUTATION-TIER TIMEOUT). ${basis}.`,
            'Advisory only: this file was NOT written. Author the sibling from your own measured run if you adopt the bound.',
          ].join('\n'));
        } else {
          advisory(`estimate ${estimateS.toFixed(1)} s (${basis}) is under the ${SAMPLE.DEFAULT_BOUND_S}s default — no sibling bound needed.`);
        }
      }
    }
  }
}

// 8. registration two-step — INDEPENDENT DERIVATION (SO #34): read the shard file,
// chaingraph.meta.json order.nodes, and chaingraph.json nodes directly, never a
// self-attested summary. Mirrors RIDER-KERNEL.md's SHARD-GATE-PRE-ASSEMBLE-1
// branch-aware semantics: a shard absent from origin/main and not yet registered
// is PENDING-ASSEMBLE (informational PASS), not a leak.
if (!shouldStop()) {
  const t0 = Date.now();
  if (!existsSync(SHARD_PATH)) {
    record({ label: 'Registration: shard file present', status: 'FAIL', ms: Date.now() - t0, out: `missing chaingraph/graph/nodes/${ID}.json` });
  } else {
    let onOriginMain = false;
    try {
      execFileSync('git', ['cat-file', '-e', `origin/main:chaingraph/graph/nodes/${ID}.json`], { cwd: REPO, env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
      onOriginMain = true;
    } catch { /* not on origin/main — a brand-new shard, or origin unresolvable (treated as absent, same as check-shard-assembly.mjs's fail-closed-on-assembler-branch design does not apply to a non-assembling K row) */ }
    let meta = { order: { nodes: [] } };
    try { meta = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.meta.json'), 'utf8')); } catch { /* unreadable — treated as not-registered below */ }
    const registered = Array.isArray(meta?.order?.nodes) && meta.order.nodes.includes(ID);
    let cg = { nodes: [] };
    try { cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8')); } catch { /* unreadable */ }
    const assembled = Array.isArray(cg?.nodes) && cg.nodes.some((n) => n.tool_id === ID);

    if (assembled && registered) {
      record({ label: 'Registration: shard assembled + registered', status: 'PASS', ms: Date.now() - t0, out: `${ID} present in chaingraph.meta.json order.nodes and chaingraph.json.` });
    } else if (!registered && !assembled && !onOriginMain) {
      record({ label: 'Registration: shard assembled + registered', status: 'PASS', ms: Date.now() - t0, out: `PENDING-ASSEMBLE — ${ID} is a new shard, absent from origin/main, not yet registered. ASSEMBLE-LAND owns registration (RIDER-KERNEL.md SHARD-GATE-PRE-ASSEMBLE-1) — this is NOT a leak, no action needed from this row.` });
    } else {
      record({ label: 'Registration: shard assembled + registered', status: 'FAIL', ms: Date.now() - t0, out: `NODE-REGISTRATION-GAP-1 shape: shard present on origin/main or partially registered (registered=${registered} assembled=${assembled} onOriginMain=${onOriginMain}) but not BOTH registered+assembled. Fix via ASSEMBLE-LAND, never by hand-editing chaingraph.json/chaingraph.meta.json yourself (RIDER-KERNEL.md, SO #6/#35).` });
    }
  }
}

// Page-less-class discriminator (INDEPENDENT DERIVATION, SO #34): read the SAME field
// gen-chaingraph-hub.mjs itself uses to decide whether a node is required to have a
// chaingraph/art-*.html card at all — `n.url.includes('/chaingraph/art-')`. A shard whose
// url points at tools/NNN-*.html instead (the "Kernel shard row ships page-less" class —
// its node page is structurally the assemble row's, per that memory) is OUT OF SCOPE for
// both the hub-categories membership check and the node-page/hub-link check, by the exact
// same rule the real gate already enforces — not a guess, and not the `--page-less` flag
// (kept below only as a manual override for a case this derivation cannot yet see).
let nodeUrl = null;
try {
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  nodeUrl = cg.nodes.find((n) => n.tool_id === ID)?.url ?? null;
} catch { /* handled as N-A below if unresolvable */ }
if (!nodeUrl && existsSync(SHARD_PATH)) {
  // A PENDING-ASSEMBLE shard (new, not yet in chaingraph.json) still carries its own url
  // field in the shard file itself — same field, same primary source, just not assembled yet.
  try { nodeUrl = JSON.parse(readFileSync(SHARD_PATH, 'utf8'))?.url ?? null; } catch { /* left null */ }
}
const REQUIRES_HUB_CARD = PAGE_LESS ? false : (nodeUrl ? nodeUrl.includes('/chaingraph/art-') : null);

// 9. hub-categories.json membership — only required for nodes gen-chaingraph-hub.mjs
// itself would require it for (see REQUIRES_HUB_CARD derivation above).
if (!shouldStop()) {
  const t0 = Date.now();
  if (REQUIRES_HUB_CARD === false) {
    record({ label: 'hub-categories.json membership', status: 'N-A', ms: Date.now() - t0, out: `${ID}'s chaingraph.json url (${nodeUrl ?? 'unresolved'}) is not a chaingraph/art-* page — gen-chaingraph-hub.mjs's own coverage gate does not require a hub-categories.json entry for this class (page-less shard).` });
  } else if (REQUIRES_HUB_CARD === null) {
    record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `${ID} not found in chaingraph.json — cannot derive whether a hub-categories.json entry is required.` });
  } else {
    try {
      const hub = loadHubCategories(REPO);
      const present = Object.values(hub).some((cat) => Array.isArray(cat.art_ids) && cat.art_ids.includes(ID));
      if (present) {
        record({ label: 'hub-categories.json membership', status: 'PASS', ms: Date.now() - t0, out: `${ID} present in hub-categories.json.` });
      } else {
        record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `${ID} absent from every category's art_ids[] in chaingraph/hub-categories.json — the hub category-map gate class this week's defects hit.` });
      }
    } catch (e) {
      record({ label: 'hub-categories.json membership', status: 'FAIL', ms: Date.now() - t0, out: `could not read/parse chaingraph/hub-categories.json: ${e.message}` });
    }
  }
}

// 10. node page exists + is hub-linked — same page-less exemption.
if (!shouldStop()) {
  const t0 = Date.now();
  if (REQUIRES_HUB_CARD === false) {
    record({ label: 'Node page exists + linked from a hub', status: 'N-A', ms: Date.now() - t0, out: `${ID} is a page-less shard by chaingraph.json's own url field (${nodeUrl ?? 'unresolved'}) — no chaingraph/${ID}.html is expected from this row; that page is structurally the assemble row's.` });
  } else if (!existsSync(PAGE_PATH)) {
    record({ label: 'Node page exists + linked from a hub', status: 'FAIL', ms: Date.now() - t0, out: `missing chaingraph/${ID}.html, and chaingraph.json's url field says this node IS a chaingraph/art-* page (${nodeUrl ?? 'unresolved'}).` });
  } else {
    const nav = run('Node page exists + linked from a hub', 'node scripts/check-nav-reachability.mjs');
    const pageRel = `chaingraph/${ID}.html`;
    // NAV-ISLAND-SCOPE-1 (2026-11-16): judge ONLY this PR's own page. The old rule
    // substring-matched this page's path ANYWHERE in the gate's combined output, but the
    // gate names our page in places that are NOT island findings — most notably the
    // PENDING-ASSEMBLE excusal section, which is the NORMAL state of a new node page
    // until main-side registration lands (SO #35). Measured 2026-11-13, merge_group run
    // 43389851037: main's derived regen for chaingraph/art-832-card-data-flow-scope.html
    // had failed its copy-hallmarks cap, so that merged-but-unlinked page sat on main,
    // this sub-gate exited 1 on it, and our own excused page's path in the same output
    // made this step FAIL the unrelated art-816 preflight with "1 NEW island(s):
    // chaingraph/art-832-...". A page on main that is unreachable because main's regen
    // is red must not fail another PR's kernel preflight. The gate now prints one
    // machine-readable verdict line on both plain-check exits —
    //   nav-reachability: FAILING-ISLANDS <n>[ <path>...]
    // — and this check reads THAT set, never the prose: our page in the set is a real
    // island we own (wire it into a hub); our page merely excused or reachable is a
    // PASS; islands outside the set belong to main's tree and their own rows. A
    // non-zero exit with no parsable line (sub-gate NOT_EVALUABLE, format drift) fails
    // CLOSED — a result we cannot read is never a green (NAV-SUBGATE-CRASH-1, SO #34c).
    const line = nav.out.split('\n').find((l) => l.startsWith('nav-reachability: FAILING-ISLANDS'));
    const toks = line ? line.trim().split(/\s+/) : null;
    const count = toks ? Number(toks[2]) : NaN;
    const wellFormed = !!toks && toks.length >= 3 && Number.isInteger(count) && count === toks.length - 3;
    const failing = wellFormed ? new Set(toks.slice(3)) : null;
    if (nav.status === 'PASS') {
      record({ label: 'Node page exists + linked from a hub', status: 'PASS', ms: nav.ms, out: `chaingraph/${ID}.html exists and check-nav-reachability.mjs passed with 0 failing islands.` });
    } else if (!failing) {
      record({ label: 'Node page exists + linked from a hub', status: 'FAIL', ms: nav.ms, out: `check-nav-reachability.mjs failed but printed no parsable FAILING-ISLANDS verdict line — its result cannot be classified, so this check fails closed rather than guess (NAV-SUBGATE-CRASH-1: a verdict that was never computed is never a green). Nothing is attributed to chaingraph/${ID}.html.\n${nav.out}` });
    } else if (failing.has(pageRel)) {
      record({ label: 'Node page exists + linked from a hub', status: 'FAIL', ms: nav.ms, out: `chaingraph/${ID}.html is an unreachable island per check-nav-reachability.mjs (NAV-ISLAND-1) — wire it into a hub.\n${nav.out}` });
    } else {
      record({ label: 'Node page exists + linked from a hub', status: 'PASS', ms: nav.ms, out: `chaingraph/${ID}.html is NOT among the ${count} new island(s) check-nav-reachability.mjs failed on (NAV-ISLAND-SCOPE-1: ${[...failing].join(', ')} sit on main's tree and are owned by main-side regen or their own rows — a page unreachable because main's regen is red must not fail this PR's kernel preflight).\n${nav.out}` });
    }
  }
}

// 11. cited_clause_digest present-or-explicitly-N/A — INDEPENDENT DERIVATION: read
// the shard's own standards_basis/cited_clause_digest fields (SO #34), never a
// summary. The `regulatory_basis` kernel-output-field discriminator is the same
// one FAST-PROVE-BATCH-1 used to classify standards-implementing vs not (grepped
// from the kernel source, since only 4/616 nodes carry standards_basis today —
// see ORCH CORRECTION on this row: this check reports N-A for a non-standards
// node, never weakens or drops the check itself).
if (!shouldStop()) {
  const t0 = Date.now();
  let shard = null;
  try { shard = JSON.parse(readFileSync(SHARD_PATH, 'utf8')); } catch { /* handled by registration check above */ }
  const kernelSrc = readFileSync(KERNEL_PATH, 'utf8');
  const looksStandardsImplementing = /\bregulatory_basis\s*:/.test(kernelSrc) || shard?.standards_basis === 'implements_standard';

  if (shard?.standards_basis === 'not_applicable') {
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'N-A', ms: Date.now() - t0, out: `${ID} declares standards_basis:"not_applicable".` });
  } else if (shard?.standards_basis === 'implements_standard' || shard?.standards_basis === 'cites_informative') {
    // SPEC.md §30.3 defines THREE values and §30.3a (NODE-CITATION-CLASS-FIX-1) added
    // `cites_informative`, which "REQUIRES a non-empty cited_clause_digest[], identically to
    // `implements_standard` (§30.5) — it is a provenance class, not an opt-out". This branch
    // previously knew only two of the three, so a node declaring the third was reported as
    // carrying "no standards_basis field at all" and hard-failed — the §15 SSOT gate
    // (check-clause-digest.mjs) accepted it and stayed green, so the same rule read opposite
    // on two surfaces. Digest requirement is unchanged for both classes; only not_applicable
    // needs none.
    const basis = shard.standards_basis;
    const digests = Array.isArray(shard.cited_clause_digest) ? shard.cited_clause_digest : [];
    if (digests.length > 0) {
      record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'PASS', ms: Date.now() - t0, out: `standards_basis:"${basis}" with ${digests.length} cited_clause_digest entr(ies) present.` });
    } else {
      record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'FAIL', ms: Date.now() - t0, out: `standards_basis:"${basis}" but cited_clause_digest[] is empty — SO #38 violation (§30.5: both implements_standard and cites_informative require >=1 entry).` });
    }
  } else if (looksStandardsImplementing) {
    const declared = shard?.standards_basis;
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'FAIL', ms: Date.now() - t0, out: declared
      ? `kernel source declares a regulatory_basis (standards-implementing) and the shard declares standards_basis:"${declared}", which is not one of the three SPEC.md §30.3 values (implements_standard | cites_informative | not_applicable).`
      : `kernel source declares a regulatory_basis (standards-implementing) but the shard carries no standards_basis field at all — SO #38 requires "implements_standard" or "cites_informative" + cited_clause_digest[], or an explicit "not_applicable".` });
    } else {
    record({ label: 'cited_clause_digest present-or-N/A (SO #38/§30)', status: 'N-A', ms: Date.now() - t0, out: `no standards_basis field and no regulatory_basis in kernel source — not a standards-implementing node by this discriminator (the same one FAST-PROVE-BATCH-1 used). Reported N-A, never silently passed: RIDER-KERNEL/CLAUSE-DIGEST-LAND-0816-1 own backfilling this class, not this row.` });
  }
}

// 12. GPU cycle preflight (GPU-CYCLE-PREFLIGHT-1) — PROBE WHERE THE PROVER ACTUALLY IS.
//
// The prover binaries (/root/ocg-zkvm/runq-cpu and runq-gpu, per GPU-CYCLE-PREFLIGHT-SPEC.md)
// live in the WSL filesystem namespace. This script runs as a WINDOWS Node process, so the
// original `existsSync('/root/ocg-zkvm/runq-cpu')` stat-ed the WINDOWS filesystem and could
// never succeed. It therefore printed "runq-cpu not found ... on this machine" on EVERY run,
// including runs by sessions that went on to prove successfully minutes later. That line
// carried no information about capacity, and a competent session acted on it: REGZ-PHANTOM-
// ROW-FIX-1 stood down under SO #36 and made zero repo edits on a premise that was never true,
// while another row had re-proved on the same machine hours earlier.
//
// So: probe across the WSL bridge, and report only what was actually measured. The three
// states are kept strictly distinct (SO #34c — absence is a state, never an inference):
//   PRESENT    the binaries were seen, so this machine HAS prove capacity
//   ABSENT     the prover's own filesystem namespace WAS reachable and they are not in it
//   NOT-PROBED the probe could not run at all — this says NOTHING about the binaries
// The check stays N-A/informational in every state, exactly as before: it never fails a run.
// --fast still skips the whole thing outright.
//
// Cost, measured 2026-08-23 on this host: the probe itself is ~90ms while the distro is
// already running, but wsl.exe cold-starts a stopped distro, and the WSL VM idles out
// between preflight runs, so ~15s is the ordinary case. That is the whole price of the
// check, it is bounded by an explicit 60s timeout, and --fast opts out of it entirely.
{
  const t0 = Date.now();
  const LABEL = 'GPU cycle preflight (runq-cpu exec)';
  const RUNQ = '/root/ocg-zkvm/runq-cpu';
  const RUNQ_GPU = '/root/ocg-zkvm/runq-gpu';
  const WSL_CMD = `wsl.exe -e bash -lc "ls -l ${RUNQ} ${RUNQ_GPU}"`;

  // wsl.exe writes its OWN diagnostics (no distro installed, distro terminated, ...) as
  // UTF-16LE, while anything the guest's bash prints is UTF-8. Sniff for interleaved NULs
  // so a genuine WSL error is readable in the report instead of NUL-shredded.
  const decode = (buf) => {
    if (!buf || !buf.length) return '';
    const head = buf.subarray(0, Math.min(buf.length, 64));
    let nul = 0;
    for (const b of head) if (b === 0) nul += 1;
    const s = nul > head.length / 4 ? buf.toString('utf16le') : buf.toString('utf8');
    return s.replace(/\0/g, '').trim();
  };

  function probeProver() {
    if (process.platform !== 'win32') {
      // Already in a POSIX filesystem namespace (running inside WSL itself, or on a Linux
      // host/CI runner): a direct stat is the authoritative check, and its answer — either
      // way — is a measurement, not a guess.
      if (existsSync(RUNQ)) {
        return { state: 'PRESENT', where: `this filesystem namespace (platform ${process.platform})`, detail: `${RUNQ} stat-ed directly.` };
      }
      return { state: 'ABSENT', why: `${RUNQ} is not in this filesystem namespace, and platform "${process.platform}" is already the namespace the prover would live in.` };
    }
    // Windows host: the prover is one wsl.exe call away. The guest snippet always exits 0
    // and prints an explicit marker, so a non-zero exit or a missing marker means the PROBE
    // failed — it is never read as evidence the binary is absent.
    const guest = `if [ -x '${RUNQ}' ]; then echo OCG_PROVER_PRESENT; ls -l '${RUNQ}' '${RUNQ_GPU}' 2>&1; else echo OCG_PROVER_ABSENT; fi`;
    let raw;
    try {
      raw = execFileSync('wsl.exe', ['-e', 'bash', '-lc', guest], {
        stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, windowsHide: true, encoding: 'buffer',
      });
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        return { state: 'NOT-PROBED', why: 'wsl.exe is not present on this host (ENOENT), so the WSL filesystem namespace cannot be reached from here.' };
      }
      if (e && (e.code === 'ETIMEDOUT' || e.killed)) {
        return { state: 'NOT-PROBED', why: 'the wsl.exe probe did not return within 60s and was killed.' };
      }
      const err = [decode(e && e.stdout), decode(e && e.stderr)].filter(Boolean).join(' / ')
        || `${(e && e.code) || ''} ${(e && e.message) || ''}`.trim();
      return { state: 'NOT-PROBED', why: `the wsl.exe probe itself failed: ${err}` };
    }
    const out = decode(raw);
    if (out.includes('OCG_PROVER_PRESENT')) {
      return {
        state: 'PRESENT',
        where: 'the WSL filesystem namespace on this machine',
        detail: out.split('\n').filter((l) => !l.includes('OCG_PROVER_')).join('\n').trim(),
      };
    }
    if (out.includes('OCG_PROVER_ABSENT')) {
      return { state: 'ABSENT', why: `the WSL filesystem namespace was reached and ${RUNQ} is not there (or is not executable).` };
    }
    return { state: 'NOT-PROBED', why: `the wsl.exe probe returned no recognisable marker${out ? `: ${out}` : ' and no output at all'}.` };
  }

  if (FAST) {
    record({ label: LABEL, status: 'N-A', ms: 0, out: 'cycle_preflight: FAST-SKIPPED (--fast) — run without --fast before booking GPU time.' });
  } else {
    const p = probeProver();
    if (p.state === 'PRESENT') {
      // Deliberately not carried further here: the exec-preflight recipe needs per-kernel
      // policy_parameters (prep_pp_vec.mjs) and a KROOT this command cannot derive
      // generically across the estate's heterogeneous kernels. What it CAN answer — and
      // what sessions were misreading — is whether prove capacity exists at all.
      record({ label: LABEL, status: 'N-A', ms: Date.now() - t0, out: [
        `cycle_preflight: PROVE CAPACITY AVAILABLE — runq-cpu is present in ${p.where}.`,
        p.detail,
        `probe: ${WSL_CMD}`,
        'The FAST/SLOW measurement itself is still a manual step (this command does not',
        'auto-derive per-kernel policy_parameters). Exec-only preflight, no flock, no GPU:',
        `  node "$T/prep_pp_vec.mjs" "${ID}" "$KROOT" "$O/pp_${ID}.json" <vectorIndex>`,
        `  ${RUNQ} exec "$KROOT/${ID}.kernel.mjs" "$O/pp_${ID}.json"`,
        'KROOT MUST point at YOUR OWN worktree over the /mnt/c bridge, never a shared',
        'checkout: a shared KROOT proves the OLD kernel bytes and the seal still verifies.',
      ].filter(Boolean).join('\n') });
    } else if (p.state === 'ABSENT') {
      record({ label: LABEL, status: 'N-A', ms: Date.now() - t0, out: [
        `cycle_preflight: PROVER NOT PRESENT HERE — ${p.why}`,
        `probe: ${WSL_CMD}`,
        'This verdict was measured, not inferred. See GPU-CYCLE-PREFLIGHT-SPEC.md.',
      ].join('\n') });
    } else {
      record({ label: LABEL, status: 'N-A', ms: Date.now() - t0, out: [
        `cycle_preflight: NOT PROBED — ${p.why}`,
        'This says NOTHING about whether prove capacity exists: the prover lives in the WSL',
        'filesystem namespace, which this check could not reach. Determine capacity with:',
        `  ${WSL_CMD}`,
        'If those two binaries list, you HAVE prove capacity (GPU-CYCLE-PREFLIGHT-SPEC.md).',
      ].join('\n') });
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
const glyph = { PASS: '✓', FAIL: '✗', 'N-A': '·' };
const rule = '─'.repeat(96);
console.log(`\nKERNEL-PREFLIGHT ${ID}`);
console.log(rule);
for (const r of results) {
  console.log(`${glyph[r.status]} ${pad(r.status, 6)}${String(r.ms).padStart(7)}ms  ${r.label}`);
  if (r.status !== 'PASS' && r.out) {
    console.log(r.out.trim().split('\n').map((l) => `      ${l}`).join('\n'));
  }
}
console.log(rule);

// The authoring convention has no gate that can fire on a kernel nobody wrote yet, so it is printed
// where an author is already looking (AUTHORING-STANDARD-ADOPT-1). One line, every run, pass or fail.
console.log('AUTHORING: chaingraph/standard/AUTHORING-STANDARD.md — refusal-carrying exclusions (§1),');
console.log('           flag-mirror doctrine (§2), documentary citation validation (§3.1), snapshot expiry (§3.2).');
console.log(rule);

const fails = results.filter((r) => r.status === 'FAIL');
const totalMs = results.reduce((a, r) => a + r.ms, 0);
console.log(`TOTAL ${(totalMs / 1000).toFixed(1)}s wall-clock (sum of checks run; ${results.length} check(s) reached${shouldStop() ? ', stopped at first FAIL — pass --keep-going to run every check' : ''})`);

if (fails.length) {
  console.log(`\nKERNEL-PREFLIGHT ${ID}: NOT READY (${fails.length} failing)`);
  process.exit(1);
}
console.log(`\nKERNEL-PREFLIGHT ${ID}: READY`);
process.exit(0);
