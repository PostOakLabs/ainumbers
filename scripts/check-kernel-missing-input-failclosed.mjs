#!/usr/bin/env node
/**
 * scripts/check-kernel-missing-input-failclosed.mjs: KERNEL-MISSING-INPUT-FAILCLOSED-GATE-1
 *
 * STAGE 1, ADVISORY. A kernel must never return a positive verdict (READY, SPEND,
 * MET, pass-class) when a REQUIRED input has been deleted. CI cannot see this
 * defect class because every fixture supplies every field. For each kernel with
 * fixtures this script takes every fixture vector whose own expected verdict is
 * positive, and for each required input field (manifest input_schema.required)
 * runs compute() twice on a copy of that vector's inputs: once with the field
 * deleted, once with it set to null.
 *
 *   PASS  = compute() throws / returns a structured error, or the verdict is a
 *           refusal (INDETERMINATE, NOT_EVALUATED, not_evaluable, ...), or a
 *           non-positive verdict, or the verdict field disappears.
 *   FAIL  = the verdict is still positive, or the output is identical to the
 *           original positive output.
 *
 * Kernel-level states besides PASS / FAIL (never guessed into either):
 *   UNDECLARED    the manifest declares no required list, nothing to delete.
 *   UNCLASSIFIED  no fixture verdict could be read as positive/negative from the
 *                 small explicit token map below.
 *   NO-POSITIVE   fixtures exist but none expects a positive verdict.
 *   LOAD-ERROR    the kernel module could not be imported or has no compute().
 *
 * ADVISORY: this script ALWAYS exits 0. Exit 2 is reserved for a usage error or
 * a crash of the harness itself. It writes nothing into the repo tree; a debt
 * report is written only to the path given by --json. Under CI the summary is
 * also appended to $GITHUB_STEP_SUMMARY.
 *
 * Usage:
 *   node scripts/check-kernel-missing-input-failclosed.mjs [--json <file>] [--root <dir>] [--verbose]
 *     --root  directory holding chaingraph/kernels/ and manifests/ (default: this repo)
 *
 * Self-test: scripts/check-kernel-missing-input-failclosed.selftest.mjs
 * Node built-ins only; no network, no clock, no randomness.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Verdict-bearing keys of an output payload, in the order they are tried.
export const VERDICT_KEYS = ['verdict', 'status', 'decision', 'outcome', 'result', 'readiness', 'ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved'];

// The small explicit token map. Anything outside it is UNCLASSIFIED, never guessed.
const POSITIVE = new Set(['READY', 'SPEND', 'MET', 'PASS', 'PASSED', 'OK', 'APPROVED', 'ELIGIBLE', 'COMPLIANT', 'VALID', 'CONFIRMED', 'SETTLED', 'SUCCESS', 'ALLOW', 'ALLOWED', 'ACCEPT', 'ACCEPTED', 'FINAL', 'CLEAR']);
const REFUSAL = new Set(['REFUSE', 'REFUSED', 'REFUSAL', 'INDETERMINATE', 'NOT_EVALUATED', 'NOT_EVALUABLE', 'NOTEVALUATED', 'NOTEVALUABLE', 'ERROR', 'INVALID_INPUT', 'MISSING_INPUT', 'UNKNOWN']);
const NEGATIVE = new Set(['FAIL', 'FAILED', 'NOT_READY', 'NOT_MET', 'UNMET', 'REJECT', 'REJECTED', 'DENY', 'DENIED', 'INELIGIBLE', 'NON_COMPLIANT', 'INVALID', 'BLOCKED', 'NO_SPEND', 'NOT_ELIGIBLE', 'BREACH']);
const BOOL_KEYS = new Set(['ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved']);

/** @returns {'positive'|'refusal'|'negative'|'unclassified'} */
export function classifyValue(key, value) {
  if (typeof value === 'boolean') return BOOL_KEYS.has(key) ? (value ? 'positive' : 'negative') : 'unclassified';
  if (typeof value !== 'string') return 'unclassified';
  const t = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (POSITIVE.has(t)) return 'positive';
  if (REFUSAL.has(t)) return 'refusal';
  if (NEGATIVE.has(t)) return 'negative';
  return 'unclassified';
}

/** Find the verdict key/class of a payload: first VERDICT_KEYS entry present. */
export function readVerdict(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of VERDICT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, k)) return { key: k, value: payload[k], cls: classifyValue(k, payload[k]) };
  }
  return null;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Run compute() and normalise to { error } or { payload }. Never throws. */
async function run(compute, pp) {
  try {
    const res = await compute(clone(pp));
    if (res && typeof res === 'object' && (res.error || res.errors)) return { error: true, res };
    const payload = res && typeof res === 'object' && 'output_payload' in res ? res.output_payload : res;
    return { payload };
  } catch (e) {
    return { error: true, thrown: String(e && e.message || e) };
  }
}

/**
 * Analyse one kernel. Pure over its arguments: `compute` and `vectors` are
 * injected so the selftest can drive synthetic kernels.
 */
export async function analyzeKernel({ id, required, vectors, compute }) {
  const out = { id, state: null, positive_fixtures: 0, deletions_tried: 0, fails: [], required: required || [] };
  if (!required || required.length === 0) { out.state = 'UNDECLARED'; return out; }
  let classifiable = 0;
  for (const v of vectors) {
    const verdict = readVerdict(v.output_payload);
    if (!verdict || verdict.cls === 'unclassified') continue;
    classifiable++;
    if (verdict.cls !== 'positive') continue;
    const pp = v.policy_parameters || {};
    const base = await run(compute, pp);
    if (base.error) continue;   // the original input does not even run; nothing to compare against
    out.positive_fixtures++;
    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(pp, field)) continue;
      for (const mode of ['delete', 'null']) {
        const mutated = clone(pp);
        if (mode === 'delete') delete mutated[field]; else mutated[field] = null;
        out.deletions_tried++;
        const r = await run(compute, mutated);
        if (r.error) continue;                                   // structured refusal
        const mv = readVerdict(r.payload);
        const isSame = same(r.payload, base.payload);
        const positive = mv && mv.key === verdict.key && mv.cls === 'positive';
        if (positive || isSame) out.fails.push({ vector: v.name, field, mode, verdict: mv ? String(mv.value) : null, identical: isSame });
      }
    }
  }
  if (classifiable === 0 && vectors.length > 0) out.state = 'UNCLASSIFIED';
  else if (out.positive_fixtures === 0) out.state = 'NO-POSITIVE';
  else out.state = out.fails.length ? 'FAIL' : 'PASS';
  return out;
}

function parseArgs(argv) {
  const a = { json: null, root: resolve(HERE, '..'), verbose: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') a.json = argv[++i];
    else if (argv[i] === '--root') a.root = resolve(argv[++i]);
    else if (argv[i] === '--verbose') a.verbose = true;
    else { console.error(`usage: check-kernel-missing-input-failclosed.mjs [--json <file>] [--root <dir>] [--verbose] (unknown arg ${argv[i]})`); process.exit(2); }
    if ((argv[i] === undefined) || (a.json === undefined) || (a.root === undefined)) { console.error('usage: missing value for a flag'); process.exit(2); }
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const kdir = join(args.root, 'chaingraph', 'kernels');
  const fdir = join(kdir, 'fixtures');
  if (!existsSync(fdir)) { console.error(`fixtures dir not found: ${fdir}`); process.exit(2); }
  const files = readdirSync(fdir).filter((f) => f.endsWith('.fixtures.json')).sort();
  const results = [];
  for (const f of files) {
    const id = f.replace(/\.fixtures\.json$/, '');
    let doc;
    try { doc = JSON.parse(readFileSync(join(fdir, f), 'utf8')); } catch { results.push({ id, state: 'LOAD-ERROR', positive_fixtures: 0, deletions_tried: 0, fails: [], required: [], note: 'fixture json unreadable' }); continue; }
    if (!Array.isArray(doc.vectors)) continue;   // a different fixture schema (not a compute() corpus)
    const mpath = join(args.root, 'manifests', `${id}.manifest.json`);
    let required = [];
    try { required = JSON.parse(readFileSync(mpath, 'utf8'))?.input_schema?.required ?? []; } catch { required = []; }
    if (!Array.isArray(required)) required = [];
    if (required.length === 0) { results.push(await analyzeKernel({ id, required, vectors: doc.vectors, compute: null })); continue; }
    const kpath = join(kdir, `${id}.kernel.mjs`);
    let compute;
    try {
      if (!existsSync(kpath)) throw new Error('no kernel file');
      const mod = await import(pathToFileURL(kpath).href);
      compute = mod.compute;
      if (typeof compute !== 'function') throw new Error('no compute() export');
    } catch (e) {
      results.push({ id, state: 'LOAD-ERROR', positive_fixtures: 0, deletions_tried: 0, fails: [], required, note: String(e && e.message || e).slice(0, 160) });
      continue;
    }
    results.push(await analyzeKernel({ id, required, vectors: doc.vectors, compute }));
  }

  const count = (s) => results.filter((r) => r.state === s).length;
  const totals = {
    kernels_examined: results.length,
    positive_fixtures: results.reduce((n, r) => n + r.positive_fixtures, 0),
    deletions_tried: results.reduce((n, r) => n + r.deletions_tried, 0),
    FAIL: count('FAIL'),
    PASS: count('PASS'),
    UNCLASSIFIED: count('UNCLASSIFIED'),
    UNDECLARED: count('UNDECLARED'),
    NO_POSITIVE: count('NO-POSITIVE'),
    LOAD_ERROR: count('LOAD-ERROR'),
  };
  const lines = [];
  for (const r of results) {
    if (!args.verbose && r.state !== 'FAIL') continue;
    const detail = r.state === 'FAIL'
      ? `${r.fails.length} fail-open case(s) over ${r.positive_fixtures} positive fixture(s); fields ${[...new Set(r.fails.map((x) => x.field))].join(',')}`
      : (r.note || `${r.positive_fixtures} positive fixture(s), ${r.deletions_tried} deletion(s) tried`);
    lines.push(`${r.state.padEnd(12)} ${r.id}  ${detail}`);
  }
  const summary = [
    `kernel-missing-input-failclosed (stage 1, ADVISORY, always exit 0)`,
    ...lines,
    `kernels examined: ${totals.kernels_examined}  positive fixtures: ${totals.positive_fixtures}  deletions tried: ${totals.deletions_tried}`,
    `FAIL: ${totals.FAIL}  UNCLASSIFIED: ${totals.UNCLASSIFIED}  UNDECLARED: ${totals.UNDECLARED}  (PASS: ${totals.PASS}  NO-POSITIVE: ${totals.NO_POSITIVE}  LOAD-ERROR: ${totals.LOAD_ERROR})`,
  ].join('\n');
  console.log(summary);
  if (args.json) mkdirSync(dirname(resolve(args.json)), { recursive: true });
  if (args.json) writeFileSync(args.json, JSON.stringify({ stage: 1, advisory: true, totals, kernels: results }, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + summary + '\n```\n'); } catch { /* summary is best effort */ }
  }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`harness crash: ${e && e.stack || e}`); process.exit(2); });
}
