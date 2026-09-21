#!/usr/bin/env node
// check-mr-r4-null-ratchet.mjs — MR-R4-NULL-REGRESSION-GATE-1. Down-only ratchet for the
// R4 null class ("absent equals explicit null"), so the debt the caller-side normalizers
// (worker PR #383, site PR #1978) deliberately did NOT reduce cannot silently grow back.
//
// ⛔ WHY THE BASELINE IS NOT 0. The normalizers close the LIVE exposure at the two callers
// that can emit a null (MCP worker, WebMCP registrations). They do NOT change a single
// kernel byte: import a kernel directly and call compute() with `{"key": null}` and it
// still diverges from the absent form. The instrument (mr-runner.mjs, workspace scripts/)
// measures exactly that raw-kernel debt, report-only by construction. A gate that reported
// 0 after the caller fix would be measuring the fix's own shadow. So the ratchet pins the
// measured number (172 violated records at 0c8fcaee, re-derived fresh per the row — the
// design note's 171 was at 4419268e and the estate moved) and allows it ONLY to fall.
//
// ⛔ POLARITY UNCHANGED. mr-runner.mjs stays report-only: an instrument whose only job is
// to stay quiet has not been observed at all. THIS file is the separate gate reading the
// same measurement; the instrument itself is untouched and its exit code stays 0 on
// findings. This gate re-measures in-repo (kernels, fixtures and manifests are all repo
// files) using a faithful replication of the instrument's R4 cell — validated at pin time
// to agree with the fresh instrument run per kernel, and the replication contract is
// re-proven on every run by the planted controls in --self-test / the paired .test.mjs.
//
// THE RATCHET (house advisory-ratchet pattern: pinned ceiling, tighten-only writer —
// mirrors check-binary-bytes / check-compute-proof-coverage / year-fallback-parity):
//   • baseline: scripts/mr-r4-null-baseline.json — total_violations (the ceiling),
//     kernels_with_violations (provenance name-list), per_kernel_violations (0/1 map,
//     catches an offsetting move: one kernel fixed + another regressed in one PR keeps
//     the total flat and would otherwise pass).
//   • run    → re-measure this tree; any kernel above its pinned count, any NEW violating
//              kernel, or a total above the ceiling FAILS, naming the kernel(s).
//   • improve → prints the --update-baseline tighten hint (advisory; the ratchet only
//              ever tightens through the writer below, never by hand).
//   • --update-baseline → the ONLY writer. Rewrites the baseline from a live measurement
//     and refuses (exit 1) if the measurement is WORSE than the pinned baseline: a raise
//     is never absorbable. Improvement or equal → rewrite + re-pin the measured sha.
//   • --self-test → planted in-memory controls, both directions quoted (a gate nobody
//     has watched fire has not been observed at all): a Number(null)-diverge fake kernel,
//     a throw-on-null fake kernel, a clean fake kernel (detector), and above/at/below
//     baseline measurements (ratchet).
//
// The baseline is loaded through ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1) so the
// deletable-baseline defect (F-11) cannot switch this gate off either: a missing/corrupt
// baseline is a hard NON-green failure, never a default ceiling.
//
// WHAT A REGRESSION MEANS, AND WHAT DOES NOT FIX IT. A new kernel shipping `= {}` or a
// `Number(null) === 0` coercion shows up here as a new violating kernel. Adding the key to
// a manifest, editing the caller normalizers, or "fixing" the fixture does not move this
// count — only a kernel that genuinely answers the absent form for the null form does.
// ⛔ Never hand-edit a count in the baseline; the only writer is --update-baseline, and it
// cannot raise.
//
// Zero-dependency (node: builtins only). Wired into scripts/preflight.mjs.
// Paired red-proof (SO #40b / GATE-SELFTEST-META-1): scripts/check-mr-r4-null-ratchet.test.mjs.
//
// Usage:
//   node scripts/check-mr-r4-null-ratchet.mjs                 measure + ratchet (exit 1 on regression)
//   node scripts/check-mr-r4-null-ratchet.mjs --update-baseline  tighten-only rewrite (refuses to raise)
//   node scripts/check-mr-r4-null-ratchet.mjs --self-test     planted RED/GREEN controls, exit 1 if any fails to fire

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from './ratchet-baseline.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = join(REPO, 'chaingraph', 'kernels');
const FDIR = join(KDIR, 'fixtures');
const MDIR = join(REPO, 'manifests');
const BASELINE_PATH = join(HERE, 'mr-r4-null-baseline.json');
const LABEL = 'mr-r4-null-ratchet';
const REPIN_COMMAND = 'node scripts/check-mr-r4-null-ratchet.mjs --update-baseline';

// ── The instrument's R4 cell, replicated ─────────────────────────────────────────────
// Every constant below mirrors scripts/lib/mr-relations.mjs (R4) and workspace
// scripts/mr-runner.mjs (unitOf / pickVector / skipReason / settle / runCell) as of
// 0c8fcaee. Drift in EITHER direction is caught: the .test.mjs planted controls prove
// this detector still fires on the canonical defect shapes, and any change to the
// instrument's R4 semantics that moves the estate count shows up as a baseline mismatch
// on the next run (a changed count without a kernel change is a signal to re-derive and
// re-pin deliberately, never to absorb silently).

const canon = (v) => Array.isArray(v) ? v.map(canon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {})
    : v;
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const msg = (e) => String((e && e.message) || e).slice(0, 300);

/** mr-relations.mjs `declares` verbatim: a manifest input property opts out with
 *  x_null_distinct === true, or the manifest lists the property in a top-level array. */
function declares(manifest, key, prop) {
  const p = manifest?.input_schema?.properties?.[prop];
  return !!(p && p[key] === true) || (Array.isArray(manifest?.[key]) && manifest[key].includes(prop));
}

/** R4.select: up to 8 sorted top-level keys, skipping keys already holding null (both
 *  sides would be the same input — vacuous) and x_null_distinct declarations. */
export function r4SelectKeys(pp, manifest) {
  if (!pp || typeof pp !== 'object') return [];
  return Object.keys(pp).sort()
    .filter((k) => pp[k] !== null && !declares(manifest, 'x_null_distinct', k))
    .slice(0, 8);
}

/** R4.variants: for each selected key, the absent form vs the explicit-null form. */
export function r4Variants(pp, manifest) {
  return r4SelectKeys(pp, manifest).map((k) => {
    const a = clone(pp); delete a[k];      // absent
    const b = clone(pp); b[k] = null;      // explicitly null
    return { label: `absent-vs-null:${k}`, a, b, ctx: { key: k } };
  });
}

/** Kernels return either the payload or {output_payload, ...}; judge the payload. */
const unwrap = (out) => (out && typeof out === 'object' && 'output_payload' in out) ? out.output_payload : out;

/** One side, never throwing: the throw is data the classification needs. */
async function settle(fn) {
  try { return { threw: false, value: unwrap(await fn()) }; }
  catch (e) { return { threw: true, error: msg(e) }; }
}

/** The instrument's per-variant classification (runCell, R4 branch) — returns the
 *  violation record or null when the relation holds for this pair. */
export async function classifyR4Variant(variant, mod) {
  const A = await settle(() => mod.compute(variant.a));
  const B = await settle(() => mod.compute(variant.b));
  if (A.threw || B.threw) {
    if (A.threw && B.threw) {
      if (A.error === B.error) return null;                    // holds by refusal on both sides
      return { variant: variant.label, code: 'DIFFERENT_ERRORS', error_a: A.error, error_b: B.error };
    }
    return {
      variant: variant.label, code: 'ONE_SIDE_THREW',
      threw: A.threw ? 'a' : 'b',
      side: A.threw ? 'untransformed input' : 'transformed input',
      error: A.threw ? A.error : B.error,
    };
  }
  if (eq(A.value, B.value)) return null;
  return { variant: variant.label, code: 'ABSENT_NULL_DIVERGE', key: variant.ctx.key };
}

// ── Estate enumeration (mr-runner.mjs unitOf / pickVector / skipReason) ──────────────

function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }

function kernelFiles() {
  return readdirSync(KDIR).filter((f) => f.endsWith('.kernel.mjs')).sort();
}

/** The FIRST vector whose policy_parameters is a non-empty plain object, falling back to
 *  vector 0 — never "the vector that makes the relation pass" (selection never looks at a
 *  result). Mirrors mr-runner.mjs pickVector including its documented row deviation. */
export function pickVector(fixture) {
  const vs = Array.isArray(fixture?.vectors) ? fixture.vectors : [];
  for (const v of vs) {
    const pp = v?.policy_parameters;
    if (pp && typeof pp === 'object' && !Array.isArray(pp) && Object.keys(pp).length) return v;
  }
  return vs[0] || null;
}

export function skipReason(mod, manifest) {
  if (mod?.meta?.gpu === true) return 'meta.gpu:true — the JS compute path is not the proving path';
  if (manifest?.x_nondeterministic === true) return 'manifest x_nondeterministic:true';
  return null;
}

// ── Measurement ──────────────────────────────────────────────────────────────────────

/** Measure the R4 class over the whole estate of THIS tree. Returns per-kernel violated
 *  records (0/1 — the instrument's unit is the kernel×relation record) + totals. */
export async function measureR4Estate({ log } = {}) {
  const per_kernel = {};
  const codes = {};
  const skipped = {};
  let applied = 0;
  for (const f of kernelFiles()) {
    const id = f.replace(/\.kernel\.mjs$/, '');
    const fixture = readJson(join(FDIR, id + '.fixtures.json'));
    const manifest = readJson(join(MDIR, id + '.manifest.json')) || {};
    const v = pickVector(fixture);
    if (!v?.policy_parameters || typeof v.policy_parameters !== 'object') { skipped[id] = 'no vectors[i].policy_parameters in fixtures'; continue; }
    let mod;
    try { mod = await import(pathToFileURL(join(KDIR, f)).href); }
    catch (e) { skipped[id] = 'import failed: ' + String(e.message).slice(0, 160); continue; }
    const why = skipReason(mod, manifest);
    if (why) { skipped[id] = why; continue; }
    if (typeof mod.compute !== 'function') { skipped[id] = 'no exported compute()'; continue; }
    const variants = r4Variants(v.policy_parameters, manifest);
    if (!variants.length) continue;                              // NOT_APPLICABLE record
    applied++;
    let violated = null;
    for (const variant of variants) {
      const fail = await classifyR4Variant(variant, mod);
      if (fail) { violated = { code: fail.code, variant: fail.variant }; break; }   // record = one violated cell per kernel (the instrument's first-failure code wins, same as its `code` field)
    }
    if (violated) {
      per_kernel[id] = 1;
      codes[violated.code] = (codes[violated.code] || 0) + 1;
      if (log) log(`  violated ${id} · ${violated.code} · ${violated.variant}`);
    }
  }
  const kernel_ids = Object.keys(per_kernel).sort();
  return { applied, per_kernel, kernel_ids, total: kernel_ids.length, codes, skipped, kernels: kernelFiles().length };
}

// ── The ratchet itself (pure; the .test.mjs drives these directly) ───────────────────

/** Compare a measurement against the baseline. Pure. Returns:
 *  { verdict: 'GREEN' | 'REGRESSION', regressions: [...], improvements: [...] } */
export function evaluateRatchet(baseline, measurement) {
  const ceiling = assertFiniteCeiling(baseline.total_violations, { label: LABEL, keyName: 'total_violations' });
  const pinned = baseline.per_kernel_violations;
  if (!pinned || typeof pinned !== 'object' || Array.isArray(pinned)) {
    throw new Error(`${LABEL}: baseline per_kernel_violations must be an object of finite counts`);
  }
  const regressions = [];
  const improvements = [];
  for (const [id, n] of Object.entries(measurement.per_kernel)) {
    const was = pinned[id];
    if (was === undefined) regressions.push(`${id}: NEW violating kernel (0 -> ${n})`);
    else if (n > was) regressions.push(`${id}: ${was} -> ${n}`);
    else if (n < was) improvements.push(`${id}: ${was} -> ${n}`);
  }
  for (const [id, was] of Object.entries(pinned)) {
    if (measurement.per_kernel[id] === undefined && !improvements.some((s) => s.startsWith(id + ':'))) {
      improvements.push(`${id}: ${was} -> 0`);
    }
  }
  const total = measurement.total;
  if (total > ceiling) regressions.push(`total: ceiling ${ceiling} -> ${total}`);
  else if (total < ceiling) improvements.push(`total: ${ceiling} -> ${total}`);
  return { verdict: regressions.length ? 'REGRESSION' : 'GREEN', regressions, improvements };
}

/** Build the next baseline document from a measurement (the --update-baseline writer).
 *  ⛔ Tighten-only by construction: the caller must refuse when evaluateRatchet says
 *  REGRESSION, so no code path here can ever raise a ceiling. */
export function nextBaseline(prev, measurement, measured_at_sha, measured_at_utc) {
  return {
    gate: 'scripts/check-mr-r4-null-ratchet.mjs',
    row: 'MR-R4-NULL-REGRESSION-GATE-1',
    what_is_pinned: 'R4 (absent equals explicit null) VIOLATED-RECORD count over the whole kernel estate, measured by the workspace instrument (scripts/mr-runner.mjs --relation R4) and re-measured in-repo by the gate. One record per kernel x relation: a violated record is a top-level "ok":false on a record whose relation is "R4", matched per record — NEVER a bare-token grep (the code token also appears inside each record\'s nested detail.failures and inflates the count). The ceiling may only fall: --update-baseline refuses any measurement worse than the pin.',
    measured_at_sha,
    measured_at_utc,
    total_violations: measurement.total,
    kernels_with_violations: measurement.kernel_ids,
    per_kernel_violations: measurement.per_kernel,
    ...(prev?.what_is_pinned_note ? { what_is_pinned_note: prev.what_is_pinned_note } : {}),
  };
}

function gitHeadSha() {
  // env: gitEnv() (GIT-ENV-LEAK-SWEEP-1) — without it the child inherits the ambient
  // GIT_* environment and, under .githooks/pre-push, answers about the OUTER git command's
  // tree regardless of cwd; with it, cwd is the only thing that decides the tree.
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8', env: gitEnv() }).trim(); }
  catch { return '(unknown — git unavailable)'; }
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────

const BASELINE_REQUIRED_KEYS = [
  'total_violations',
  { key: 'kernels_with_violations', type: 'name-list' },
];

function loadBaseline() {
  return loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, {
    label: LABEL,
    repinCommand: REPIN_COMMAND,
  });
}

function validatePerKernelMap(baseline) {
  const map = baseline.per_kernel_violations;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    console.error(`✗ ${LABEL}: baseline per_kernel_violations missing or not an object — restore scripts/mr-r4-null-baseline.json (git checkout origin/main -- scripts/mr-r4-null-baseline.json) or re-pin with \`${REPIN_COMMAND}\`.`);
    process.exit(1);
  }
  for (const [k, v] of Object.entries(map)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      console.error(`✗ ${LABEL}: baseline per_kernel_violations[${JSON.stringify(k)}] must be a finite number, got ${JSON.stringify(v)} — a non-finite per-kernel count is the disabled-ratchet state (RATCHET-BASELINE-LOADER-1 / F-11 shape).`);
      process.exit(1);
    }
  }
  for (const id of baseline.kernels_with_violations) {
    if (map[id] === undefined) {
      console.error(`✗ ${LABEL}: kernels_with_violations lists ${id} but per_kernel_violations has no entry for it — the two provenance views disagree; restore the baseline or re-pin.`);
      process.exit(1);
    }
  }
}

async function measure() {
  process.stdout.write(`mr-r4-null-ratchet: measuring R4 over ${kernelFiles().length} kernels in this tree...\n`);
  const m = await measureR4Estate();
  process.stdout.write(`mr-r4-null-ratchet: applied ${m.applied}/${m.kernels}, violated records ${m.total} (${Object.entries(m.codes).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}), skipped ${Object.keys(m.skipped).length}\n`);
  return m;
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self-test')) process.exit(await selfTest());

  if (argv.includes('--update-baseline')) {
    const prev = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, { label: LABEL, repinCommand: REPIN_COMMAND });
    if (prev) validatePerKernelMap(prev);
    const m = await measure();
    if (prev) {
      const verdict = evaluateRatchet(prev, m);
      if (verdict.verdict === 'REGRESSION') {
        console.error(`✗ ${LABEL}: --update-baseline REFUSED — the measurement is WORSE than the pinned baseline. A ratchet ceiling may only fall; a raise is never absorbable:`);
        for (const r of verdict.regressions) console.error(`  ⛔ ${r}`);
        console.error('  Fix the regression (the kernel must answer the absent form for the null form, or declare x_null_distinct if null is genuinely a third state for it), then re-run.');
        process.exit(1);
      }
    }
    const doc = nextBaseline(prev || {}, m, gitHeadSha(), new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log(`✓ ${LABEL}: baseline re-pinned at total_violations=${doc.total_violations}, measured_at_sha=${doc.measured_at_sha}${prev && prev.total_violations !== doc.total_violations ? ` (tightened from ${prev.total_violations})` : ''}`);
    process.exit(0);
  }

  // Default: strict check.
  const baseline = loadBaseline();
  validatePerKernelMap(baseline);
  const m = await measure();
  const verdict = evaluateRatchet(baseline, m);
  if (verdict.verdict === 'REGRESSION') {
    console.error(`✗ mr-r4-null-ratchet: R4 REGRESSION — the null class grew. The R4 relation (absent equals explicit null) is violated by MORE kernels than the baseline pins:`);
    for (const r of verdict.regressions) console.error(`  ⛔ ${r}`);
    console.error(`  A kernel must give the null form exactly the absent form's answer (or declare x_null_distinct on the input property if null is genuinely a third state for it).`);
    console.error(`  ⛔ Do NOT absorb this by re-pinning: \`--update-baseline\` refuses raises by design (MR-R4-NULL-REGRESSION-GATE-1).`);
    process.exit(1);
  }
  console.log(`✓ mr-r4-null-ratchet: R4 violated records ${m.total} <= pinned ${baseline.total_violations} (baseline @ ${baseline.measured_at_sha}) — down-only ratchet holds`);
  if (verdict.improvements.length) {
    console.log(`mr-r4-null-ratchet: ${verdict.improvements.length} kernel(s) beat the baseline — tighten with \`${REPIN_COMMAND}\`:\n  ` + verdict.improvements.slice(0, 15).join('\n  ') + (verdict.improvements.length > 15 ? `\n  ... and ${verdict.improvements.length - 15} more` : ''));
  }
  process.exit(0);
}

// ── --self-test: planted controls, both directions (GATE-SELFTEST-META-1) ────────────
// In-memory fake kernels, never estate files: a detector that needed a real defect to
// demonstrate itself would go quiet the moment the estate gets fixed — exactly the
// seen-firing property this control exists to keep.

async function selfTest() {
  const results = [];
  const check = (name, ok) => { results.push({ name, ok }); console.log(`${ok ? '✓' : '⛔'} self-test: ${ok ? 'FIRED' : 'DID NOT FIRE'} — ${name}`); };

  // (1) Detector, RED direction — the two canonical defect shapes from the design note.
  const scalarDiverge = { meta: { gpu: false }, compute: async (pp) => ({ out: { v: Number(pp.x) } }) };               // Number(null) === 0
  const nullDiverge = { meta: { gpu: false }, compute: async (pp) => (pp.x === undefined ? { out: { v: 12 } } : { out: { v: pp.x ?? 0 } }) };
  const throwOnNull = { meta: { gpu: false }, compute: async (pp) => { const { o = {} } = pp; return { out: { f: o.f } }; } }; // destructure default skips null -> throws on o.f? (o is null)
  // Make the throw shape throw exactly like art-135: reading a property OF the null default.
  throwOnNull.compute = async (pp) => { const { o = {} } = pp; return { out: { f: String(o.f).trim() } }; };

  const variants = r4Variants({ x: 12 }, {});
  check('Number(null) scalar divergence is VIOLATED (ABSENT_NULL_DIVERGE)',
    (await classifyR4Variant(variants[0], scalarDiverge))?.code === 'ABSENT_NULL_DIVERGE');
  check('explicit-null third-state divergence is VIOLATED (ABSENT_NULL_DIVERGE)',
    (await classifyR4Variant(variants[0], nullDiverge))?.code === 'ABSENT_NULL_DIVERGE');
  const objVariants = r4Variants({ o: { f: 'x' } }, {});
  check('one-side-throws on null is VIOLATED (ONE_SIDE_THREW, transformed side)',
    (await classifyR4Variant(objVariants[0], throwOnNull))?.code === 'ONE_SIDE_THREW'
      && (await classifyR4Variant(objVariants[0], throwOnNull))?.threw === 'b');

  // (2) Detector, GREEN direction — a kernel that already answers null as absent holds.
  const clean = { meta: { gpu: false }, compute: async (pp) => ({ out: { v: pp.x === undefined || pp.x === null ? 12 : pp.x } }) };
  check('a kernel answering null as absent holds (no violation)', (await classifyR4Variant(variants[0], clean)) === null);
  const refusesBoth = { meta: { gpu: false }, compute: async (pp) => { if (pp.x === undefined || pp.x === null) throw new Error('x required'); return { out: { v: pp.x } }; } };
  check('a kernel refusing null AND absent holds by refusal (no violation)', (await classifyR4Variant(variants[0], refusesBoth)) === null);

  // (3) x_null_distinct exclusion — the declared third state is out of the relation's scope.
  const schema = { input_schema: { properties: { x: { type: 'number', x_null_distinct: true } } } };
  check('x_null_distinct excludes the property from the variants', r4Variants({ x: null ?? 1, y: 1 }, schema).length === 1
    && r4Variants({ x: 1 }, schema).length === 0);

  // (4) Ratchet, both directions — plant a measurement above the pin (must FAIL) and one
  // below it (must GREEN + offer the tighten), plus the offsetting-move control.
  const baseline = {
    total_violations: 2,
    kernels_with_violations: ['k-a', 'k-b'],
    per_kernel_violations: { 'k-a': 1, 'k-b': 1 },
  };
  const plantedIncrease = evaluateRatchet(baseline, { total: 3, per_kernel: { 'k-a': 1, 'k-b': 1, 'k-new': 1 } });
  check('planted NEW violating kernel → REGRESSION', plantedIncrease.verdict === 'REGRESSION' && plantedIncrease.regressions.some((r) => r.includes('k-new')));
  const plantedWorse = evaluateRatchet(baseline, { total: 2, per_kernel: { 'k-a': 2, 'k-b': 1 } });
  check('planted per-kernel increase (offset by nothing) → REGRESSION', plantedWorse.verdict === 'REGRESSION' && plantedWorse.regressions.some((r) => r.includes('k-a: 1 -> 2')));
  const offsetting = evaluateRatchet(baseline, { total: 2, per_kernel: { 'k-a': 2, 'k-b': 0, 'k-c': 0 } });
  check('offsetting move (k-a worse, k-b fixed, total flat) → still REGRESSION on the kernel view', offsetting.verdict === 'REGRESSION' && offsetting.regressions.some((r) => r.includes('k-a: 1 -> 2')));
  const improvement = evaluateRatchet(baseline, { total: 1, per_kernel: { 'k-a': 1 } });
  check('one kernel fixed → GREEN with a tighten improvement', improvement.verdict === 'GREEN' && improvement.improvements.some((r) => r.includes('k-b: 1 -> 0')));
  const atBaseline = evaluateRatchet(baseline, { total: 2, per_kernel: { 'k-a': 1, 'k-b': 1 } });
  check('exact pin → GREEN with no regressions and no improvements', atBaseline.verdict === 'GREEN' && atBaseline.improvements.length === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length
    ? `⛔ mr-r4-null-ratchet --self-test: ${failed.length} control(s) did not fire — the detector or ratchet is broken; the gate must not be trusted until this is green.`
    : `✓ mr-r4-null-ratchet --self-test: all ${results.length} planted controls fired (RED on defects and increases, GREEN on holds and improvements)`);
  return failed.length ? 1 : 0;
}

// CLI-vs-import guard (house pattern, cf. check-binary-bytes.mjs): importing this module
// from the paired .test.mjs must have NO side effects — the CLI runs only when this file
// IS the entry script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`✗ ${LABEL}: ` + (e && e.stack || e)); process.exit(1); });
}
