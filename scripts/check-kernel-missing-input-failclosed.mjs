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
 *   UNDECLARED    neither the manifest nor the node shard declares a required list.
 *                 Required fields come from the declared list ONLY. For such kernels the
 *                 harness still tries every top-level key, but hits are reported as
 *                 HARNESS-SUSPECT (advisory) and are never counted as FAIL.
 *   UNCLASSIFIED  no fixture verdict could be read as positive/negative from the
 *                 small explicit token map below.
 *   NO-POSITIVE   fixtures exist but none expects a positive verdict.
 *   LOAD-ERROR    the kernel module could not be imported or has no compute().
 *
 * ADVISORY by default: without --enforce this script ALWAYS exits 0. Exit 2 is
 * reserved for a usage error or a crash of the harness itself.
 * STAGE 2 (KERNEL-MISSING-INPUT-FAILCLOSED-GATE-2): --enforce <baseline> exits 1 when a
 * FAIL pair (node id + field) exists that the baseline does not list; a kernel absent
 * from the baseline is new and must have zero FAIL pairs. The baseline is read-only here. It writes nothing into the repo tree; a debt
 * report is written only to the path given by --json. Under CI the summary is
 * also appended to $GITHUB_STEP_SUMMARY.
 *
 * Usage:
 *   node scripts/check-kernel-missing-input-failclosed.mjs [--json <file>] [--write-baseline <file>] [--enforce <baseline>] [--only <id,id>] [--root <dir>] [--verbose]
 *     --write-baseline  record the current FAIL pairs (node id + deleted field)
 *     --enforce         blocking mode against a baseline (see above)
 *     --only            sweep just these kernel ids (seconds, for the kernel you just wrote)
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
export const VERDICT_KEYS = ['verdict', 'status', 'decision', 'outcome', 'result', 'readiness', 'eligibility', 'profile_status', 'ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved', 'conserved', 'within_mandate'];

// The small explicit token map. Anything outside it is UNCLASSIFIED, never guessed.
const POSITIVE = new Set(['READY', 'SPEND', 'MET', 'PASS', 'PASSED', 'OK', 'APPROVED', 'ELIGIBLE', 'COMPLIANT', 'VALID', 'CONFIRMED', 'SETTLED', 'SUCCESS', 'ALLOW', 'ALLOWED', 'ACCEPT', 'ACCEPTED', 'FINAL', 'CLEAR', 'WITHIN_MANDATE', 'CONSERVED']);
const REFUSAL = new Set(['REFUSE', 'REFUSED', 'REFUSAL', 'INDETERMINATE', 'NOT_EVALUATED', 'NOT_EVALUABLE', 'NOTEVALUATED', 'NOTEVALUABLE', 'ERROR', 'INVALID_INPUT', 'MISSING_INPUT', 'UNKNOWN']);
const NEGATIVE = new Set(['FAIL', 'FAILED', 'NOT_READY', 'NOT_MET', 'UNMET', 'REJECT', 'REJECTED', 'DENY', 'DENIED', 'INELIGIBLE', 'NON_COMPLIANT', 'INVALID', 'BLOCKED', 'NO_SPEND', 'NOT_ELIGIBLE', 'BREACH', 'OUTSIDE_MANDATE', 'NOT_CONSERVED', 'EXCEEDS_MANDATE']);
const BOOL_KEYS = new Set(['ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved', 'conserved', 'within_mandate']);

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
export async function analyzeKernel({ id, required, vectors, compute, suspectAll = false }) {
  const declared = Array.isArray(required) && required.length > 0;
  const out = { id, state: null, positive_fixtures: 0, deletions_tried: 0, fails: [], suspects: [], required: required || [] };
  // No declared required list: the kernel is UNDECLARED. With suspectAll the harness
  // still treats every top-level key as a candidate, but those hits go to `suspects`
  // (HARNESS-SUSPECT, advisory) and never to `fails`.
  if (!declared && !(suspectAll && compute)) { out.state = 'UNDECLARED'; return out; }
  const sink = declared ? out.fails : out.suspects;
  let classifiable = 0;
  let positives = 0;
  for (const v of vectors) {
    const verdict = readVerdict(v.output_payload);
    if (!verdict || verdict.cls === 'unclassified') continue;
    classifiable++;
    if (verdict.cls !== 'positive') continue;
    const pp = v.policy_parameters || {};
    const base = await run(compute, pp);
    if (base.error) continue;   // the original input does not even run; nothing to compare against
    positives++;
    if (declared) out.positive_fixtures++;
    for (const field of declared ? required : Object.keys(pp)) {
      if (!Object.prototype.hasOwnProperty.call(pp, field)) continue;
      for (const mode of ['delete', 'null']) {
        const mutated = clone(pp);
        if (mode === 'delete') delete mutated[field]; else mutated[field] = null;
        if (declared) out.deletions_tried++;
        const r = await run(compute, mutated);
        if (r.error) continue;                                   // structured refusal
        const mv = readVerdict(r.payload);
        const isSame = same(r.payload, base.payload);
        const positive = mv && mv.key === verdict.key && mv.cls === 'positive';
        if (positive || isSame) sink.push({ vector: v.name, field, mode, verdict: mv ? String(mv.value) : null, identical: isSame });
      }
    }
  }
  if (!declared) { out.state = 'UNDECLARED'; return out; }
  if (classifiable === 0 && vectors.length > 0) out.state = 'UNCLASSIFIED';
  else if (positives === 0) out.state = 'NO-POSITIVE';
  else out.state = out.fails.length ? 'FAIL' : 'PASS';
  return out;
}

/** Stable, sorted, de-duplicated FAIL pairs (node id + deleted field) for the baseline writer. */
export function failPairs(results) {
  const pairs = new Set();
  for (const r of results) if (r.state === 'FAIL') for (const f of r.fails) pairs.add(`${r.id}\u0000${f.field}`);
  return [...pairs].sort().map((p) => { const [node, field] = p.split('\u0000'); return { node, field }; });
}

/**
 * Baseline document for a future blocking stage: per-node counts and the pair list.
 * Same ratchet convention as the copy-hallmarks baseline (a JSON map, counts only go
 * down, regenerated by an explicit flag). Written ONLY by --write-baseline; stage 1
 * never reads or enforces it.
 */
export function buildBaseline(results) {
  const pairs = failPairs(results);
  const nodes = {};
  for (const p of pairs) { (nodes[p.node] ||= { fields: [] }).fields.push(p.field); }
  for (const n of Object.values(nodes)) n.count = n.fields.length;
  return { nodes, total_pairs: pairs.length };
}

/**
 * Stage 2 decision. `baseline` is the parsed baseline document ({ nodes: { id: { fields } } }).
 * Returns every FAIL case whose (node, field) pair is not in the baseline. A kernel absent
 * from the baseline is new, so every one of its FAIL pairs is a violation. The baseline is
 * only ever read here: it can shrink (by a regeneration after a cure) and never grows.
 */
export function enforceAgainstBaseline(results, baseline) {
  const known = new Map(Object.entries(baseline?.nodes || {}).map(([id, n]) => [id, new Set(n.fields || [])]));
  const violations = [];
  for (const r of results) {
    if (r.state !== 'FAIL') continue;
    const allowed = known.get(r.id);
    const seen = new Set();
    for (const f of r.fails) {
      if (allowed && allowed.has(f.field)) continue;
      const key = `${f.field}\u0000${f.mode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ node: r.id, field: f.field, mode: f.mode, verdict: f.verdict, identical: f.identical, isNew: !allowed });
    }
  }
  return violations;
}

export function describeViolation(v) {
  const mutated = v.mode === 'delete' ? 'deleted' : 'set to null';
  const survived = v.verdict !== null && v.verdict !== undefined ? `verdict ${v.verdict} survived` : 'the output was identical to the positive output';
  return `${v.node}: required input "${v.field}" ${mutated}, ${survived}${v.isNew ? ' (kernel not in baseline: new kernels must have zero FAIL pairs)' : ''}. Refuse or return a non-positive verdict when this input is missing.`;
}

function parseArgs(argv) {
  const a = { json: null, baseline: null, enforce: null, only: null, root: resolve(HERE, '..'), verbose: false };
  const usage = 'usage: check-kernel-missing-input-failclosed.mjs [--json <file>] [--write-baseline <file>] [--enforce <baseline>] [--only <id,id>] [--root <dir>] [--verbose]';
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) { console.error(`${usage} (missing value for ${flag})`); process.exit(2); } return v; };
    if (flag === '--json') a.json = val();
    else if (flag === '--write-baseline') a.baseline = val();
    else if (flag === '--enforce') a.enforce = resolve(val());
    else if (flag === '--only') a.only = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--root') a.root = resolve(val());
    else if (flag === '--verbose') a.verbose = true;
    else { console.error(`${usage} (unknown arg ${flag})`); process.exit(2); }
  }
  if (a.only && a.only.length === 0) { console.error(`${usage} (--only needs at least one id)`); process.exit(2); }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const kdir = join(args.root, 'chaingraph', 'kernels');
  const fdir = join(kdir, 'fixtures');
  if (!existsSync(fdir)) { console.error(`fixtures dir not found: ${fdir}`); process.exit(2); }
  let files = readdirSync(fdir).filter((f) => f.endsWith('.fixtures.json')).sort();
  if (args.only) {
    // --only: a builder checks the kernel it just wrote. An id with no fixture file is a usage error, not a silent pass.
    const missing = args.only.filter((id) => !files.includes(`${id}.fixtures.json`));
    if (missing.length) { console.error(`--only: no fixtures file for ${missing.join(', ')}`); process.exit(2); }
    files = files.filter((f) => args.only.includes(f.replace(/\.fixtures\.json$/, '')));
  }
  let baselineDoc = null;
  if (args.enforce) {
    try { baselineDoc = JSON.parse(readFileSync(args.enforce, 'utf8')); } catch (e) { console.error(`--enforce: cannot read baseline ${args.enforce}: ${e && e.message}`); process.exit(2); }
    if (!baselineDoc || typeof baselineDoc.nodes !== 'object') { console.error(`--enforce: ${args.enforce} has no "nodes" map`); process.exit(2); }
  }
  const results = [];
  const shardRequired = new Map();   // tool_id -> input_schema.required from the node shard
  const ndir = join(args.root, 'chaingraph', 'graph', 'nodes');
  if (existsSync(ndir)) {
    for (const nf of readdirSync(ndir).filter((x) => x.endsWith('.json'))) {
      try {
        const s = JSON.parse(readFileSync(join(ndir, nf), 'utf8'));
        const req = s?.input_schema?.required;
        if (s?.tool_id && Array.isArray(req) && req.length) shardRequired.set(s.tool_id, req);
      } catch { /* an unreadable shard declares nothing */ }
    }
  }
  for (const f of files) {
    const id = f.replace(/\.fixtures\.json$/, '');
    let doc;
    try { doc = JSON.parse(readFileSync(join(fdir, f), 'utf8')); } catch { results.push({ id, state: 'LOAD-ERROR', positive_fixtures: 0, deletions_tried: 0, fails: [], required: [], note: 'fixture json unreadable' }); continue; }
    if (!Array.isArray(doc.vectors)) continue;   // a different fixture schema (not a compute() corpus)
    const mpath = join(args.root, 'manifests', `${id}.manifest.json`);
    // Declared lists only: manifest input_schema.required, else the node shard's.
    let required = [];
    try { required = JSON.parse(readFileSync(mpath, 'utf8'))?.input_schema?.required ?? []; } catch { required = []; }
    if (!Array.isArray(required) || required.length === 0) required = shardRequired.get(id) || [];
    const kpath = join(kdir, `${id}.kernel.mjs`);
    let compute;
    try {
      if (!existsSync(kpath)) throw new Error('no kernel file');
      const mod = await import(pathToFileURL(kpath).href);
      compute = mod.compute;
      if (typeof compute !== 'function') throw new Error('no compute() export');
    } catch (e) {
      if (required.length === 0) { results.push(await analyzeKernel({ id, required, vectors: doc.vectors, compute: null })); continue; }   // nothing declared, nothing to sweep
      results.push({ id, state: 'LOAD-ERROR', positive_fixtures: 0, deletions_tried: 0, fails: [], required, note: String(e && e.message || e).slice(0, 160) });
      continue;
    }
    results.push(await analyzeKernel({ id, required, vectors: doc.vectors, compute, suspectAll: true }));
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
    HARNESS_SUSPECT: results.reduce((n, r) => n + (r.suspects ? r.suspects.length : 0), 0),
    HARNESS_SUSPECT_KERNELS: results.filter((r) => r.suspects && r.suspects.length).length,
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
    args.enforce ? `kernel-missing-input-failclosed (stage 2, ENFORCE against ${args.enforce.split(/[\\/]/).pop()})` : `kernel-missing-input-failclosed (stage 1, ADVISORY, always exit 0)`,
    ...lines,
    `kernels examined: ${totals.kernels_examined}  positive fixtures: ${totals.positive_fixtures}  deletions tried: ${totals.deletions_tried}`,
    `FAIL: ${totals.FAIL}  HARNESS-SUSPECT: ${totals.HARNESS_SUSPECT_KERNELS} kernel(s), ${totals.HARNESS_SUSPECT} pair(s) (advisory, undeclared list)  UNCLASSIFIED: ${totals.UNCLASSIFIED}  UNDECLARED: ${totals.UNDECLARED}  (PASS: ${totals.PASS}  NO-POSITIVE: ${totals.NO_POSITIVE}  LOAD-ERROR: ${totals.LOAD_ERROR})`,
  ].join('\n');
  console.log(summary);
  if (args.json) mkdirSync(dirname(resolve(args.json)), { recursive: true });
  if (args.json) writeFileSync(args.json, JSON.stringify({ stage: 1, advisory: true, totals, kernels: results }, null, 2) + '\n');
  // Stage 2 groundwork: record the current FAIL pairs. Stage 1 never reads this file back.
  if (args.baseline) {
    mkdirSync(dirname(resolve(args.baseline)), { recursive: true });
    writeFileSync(args.baseline, JSON.stringify(buildBaseline(results), null, 2) + '\n');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + summary + '\n```\n'); } catch { /* summary is best effort */ }
  }
  if (baselineDoc) {
    const violations = enforceAgainstBaseline(results, baselineDoc);
    if (violations.length) {
      for (const v of violations) console.error(`FAIL-OPEN ${describeViolation(v)}`);
      console.error(`kernel-missing-input-failclosed: ${violations.length} fail-open pair(s) not in the baseline. The baseline never grows; fix the kernel.`);
      process.exit(1);
    }
    console.log('kernel-missing-input-failclosed: no fail-open pair outside the baseline');
  }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`harness crash: ${e && e.stack || e}`); process.exit(2); });
}
