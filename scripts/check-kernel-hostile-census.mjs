#!/usr/bin/env node
// check-kernel-hostile-census.mjs
//
// ADVISORY hostile-input census for kernels. For each kernel a PR adds or changes
// (chaingraph/kernels/<id>.kernel.mjs, never a `_` helper or a proptest) it derives
// hostile variants of the kernel's own golden fixture input and runs compute() and
// buildArtifact() on each. NaN and Infinity are excluded (JSON cannot carry them).
//
// Mutation classes, per input field where the class applies:
//   deleted, null, wrong-type, proto-key, proto-value, unsafe-int (2^53),
//   1e300, bad-date (2026-02-31), numeric-string, padded-enum.
//
// Per kernel it reports:
//   compute-throws      compute() threw on the variant
//   build-throws        compute() completed while buildArtifact() threw
//   accepted-clean      neither a refusal nor a finding (the variant was silently accepted)
// A "refusal" is a compute() result whose JSON carries a truthy refus*/invalid*/reject*/error*
// key or a determination value matching INVALID|REFUS|REJECT|ERROR.
//
// ADVISORY: prints a table and exits 0. `--strict` (verifier use, not wired) exits 1 when
// any kernel shows a throws or build-throws finding.
//
// Usage:
//   node scripts/check-kernel-hostile-census.mjs                 kernels changed vs origin/main
//   node scripts/check-kernel-hostile-census.mjs --all           every kernel (the census)
//   node scripts/check-kernel-hostile-census.mjs --kernel <id>   one kernel by file stem
//   node scripts/check-kernel-hostile-census.mjs --self-test     planted-kernel controls
// Flags: --base <ref> (default origin/main), --budget-ms <n> per kernel (default 4000),
//        --max-fields <n> per kernel (default 80), --strict.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, execFile } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KDIR = resolve(ROOT, 'chaingraph/kernels');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const BUDGET_MS = Number(opt('--budget-ms', 4000));
const MAX_FIELDS = Number(opt('--max-fields', 80));

// ---------- mutation derivation ----------

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;

// Every path (array of keys) to a value in the input, depth-first, capped.
function collectPaths(obj, cap) {
  const out = [];
  const walk = (v, path) => {
    if (out.length >= cap) return;
    if (path.length) out.push(path);
    if (Array.isArray(v)) v.slice(0, 2).forEach((x, i) => walk(x, [...path, i]));
    else if (isPlain(v)) for (const k of Object.keys(v)) walk(v[k], [...path, k]);
  };
  walk(obj, []);
  return out;
}

const getAt = (o, p) => p.reduce((a, k) => a[k], o);

function withAt(base, path, fn) {
  const clone = structuredClone(base);
  if (!path.length) return fn(clone, null, null);
  const parent = getAt(clone, path.slice(0, -1));
  return fn(clone, parent, path[path.length - 1]);
}

function setOwn(o, k, v) {
  Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });
}

// Returns [{ cls, path, make() -> mutated input }]
function deriveMutations(base, maxFields) {
  const muts = [];
  const add = (cls, path, mutate) => muts.push({
    cls, path: path.join('.') || '(root)',
    make: () => withAt(base, path, (clone, parent, key) => {
      if (key === null) return mutate(clone, null, null);
      mutate(clone, parent, key);
      return clone;
    }),
  });
  const setVal = (v) => (c, p, k) => { setOwn(p, k, typeof v === 'function' ? v(p[k]) : v); };

  for (const path of collectPaths(base, maxFields)) {
    const v = getAt(base, path);
    const last = path[path.length - 1];
    add('deleted', path, (c, p, k) => { if (Array.isArray(p)) p.splice(k, 1); else delete p[k]; });
    add('null', path, setVal(null));
    add('wrong-type', path, setVal(typeof v === 'string' ? 7 : typeof v === 'number' ? 'x' : Array.isArray(v) ? {} : isPlain(v) ? [] : 'x'));
    if (typeof v === 'string') {
      add('proto-value', path, setVal('__proto__'));
      add('proto-value', path, setVal('constructor'));
      if (DATE_RE.test(v)) add('bad-date', path, setVal('2026-02-31'));
      else add('padded-enum', path, setVal(' ' + v + ' '));
    }
    if (typeof v === 'number') {
      add('unsafe-int', path, setVal(2 ** 53));
      add('1e300', path, setVal(1e300));
      add('numeric-string', path, setVal(String(v)));
    }
    void last;
  }
  // Prototype names as injected keys at the root and at every object container.
  const containers = [[], ...collectPaths(base, maxFields).filter((p) => isPlain(getAt(base, p)))];
  for (const path of containers.slice(0, 12)) {
    for (const name of ['__proto__', 'constructor']) {
      muts.push({
        cls: 'proto-key', path: path.join('.') || '(root)',
        make: () => { const clone = structuredClone(base); setOwn(path.length ? getAt(clone, path) : clone, name, { polluted: true }); return clone; },
      });
    }
  }
  return muts;
}

// ---------- running ----------

const REFUSE_KEY = /refus|invalid|reject|error/i;
const REFUSE_VAL = /INVALID|REFUS|REJECT|ERROR/;
function looksLikeRefusal(res) {
  let hit = false;
  const walk = (v, depth) => {
    if (hit || depth > 6 || v === null || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (REFUSE_KEY.test(k) && x && (typeof x !== 'object' || Object.keys(x).length)) { hit = true; return; }
      if (typeof x === 'string' && REFUSE_VAL.test(x)) { hit = true; return; }
      walk(x, depth + 1);
    }
  };
  walk(res, 0);
  return hit;
}

const msg = (e) => String(e && e.message ? e.message : e).slice(0, 90);

export async function censusKernel(mod, baseInput, { budgetMs = BUDGET_MS, maxFields = MAX_FIELDS } = {}) {
  const r = { total: 0, computeThrows: 0, buildThrows: 0, clean: 0, cut: false, ex: {}, cleanBy: {} };
  const start = Date.now();
  for (const m of deriveMutations(baseInput, maxFields)) {
    if (Date.now() - start > budgetMs) { r.cut = true; break; }
    const input = m.make();
    r.total++;
    let res;
    try { res = mod.compute(structuredClone(input)); } catch (e) {
      r.computeThrows++; r.ex.computeThrows ??= `${m.cls} @ ${m.path}: ${msg(e)}`; continue;
    }
    if (res && typeof res.then === 'function') { try { res = await res; } catch (e) {
      r.computeThrows++; r.ex.computeThrows ??= `${m.cls} @ ${m.path}: ${msg(e)}`; continue; } }
    if (typeof mod.buildArtifact === 'function') {
      try { await mod.buildArtifact(structuredClone(input), { now: '2026-01-01T00:00:00Z' }); } catch (e) {
        r.buildThrows++; r.ex.buildThrows ??= `${m.cls} @ ${m.path}: ${msg(e)}`; continue;
      }
    }
    if (looksLikeRefusal(res)) continue;
    r.clean++; r.cleanBy[m.cls] = (r.cleanBy[m.cls] ?? 0) + 1; r.ex.clean ??= `${m.cls} @ ${m.path}`;
  }
  return r;
}

// ---------- kernel selection ----------

const isKernelFile = (f) => /^chaingraph\/kernels\/[^/_][^/]*\.kernel\.mjs$/.test(f);

function changedKernels(base) {
  let names = '';
  try {
    names = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`], { encoding: 'utf8', env: gitEnv() });
  } catch { return null; }
  return names.split('\n').filter(isKernelFile).map((f) => f.slice('chaingraph/kernels/'.length, -'.kernel.mjs'.length));
}

function allKernels() {
  return readdirSync(KDIR).filter((f) => f.endsWith('.kernel.mjs') && !f.startsWith('_'))
    .map((f) => f.slice(0, -'.kernel.mjs'.length));
}

async function loadKernel(stem) {
  const fx = resolve(KDIR, 'fixtures', `${stem}.fixtures.json`);
  if (!existsSync(fx)) return { skip: 'no fixture' };
  let doc;
  try { doc = JSON.parse(readFileSync(fx, 'utf8')); } catch { return { skip: 'fixture unreadable' }; }
  const base = doc.vectors?.[0]?.policy_parameters;
  if (!base || typeof base !== 'object') return { skip: 'fixture has no policy_parameters' };
  let mod;
  try { mod = await import(pathToFileURL(resolve(KDIR, `${stem}.kernel.mjs`)).href); } catch (e) { return { skip: 'import failed: ' + msg(e) }; }
  if (typeof mod.compute !== 'function') return { skip: 'no compute export' };
  return { mod, base };
}

// ---------- self-test: planted kernels ----------

const SELF_BASE = { amount: 100, period_end_date: '2026-02-27', mode: 'strict', rows: [{ id: 'a', qty: 3 }] };
const okOut = (extra = {}) => ({ output_payload: { determination: 'MET', ...extra }, compliance_flags: [] });
const refuse = () => ({ output_payload: { refused: true }, compliance_flags: [] });
const stdBuild = (compute) => async (pp) => { compute(pp); return { ok: true }; };

const PLANTED = {
  // throws on null: dereferences a nested field with no guard
  throwsOnNull: {
    compute: (pp) => okOut({ n: pp.rows[0].qty + pp.amount }),
    expect: (r) => r.computeThrows > 0,
  },
  // compute completes while buildArtifact throws on 2^53
  buildThrowsOnUnsafe: (() => {
    const compute = (pp) => (typeof pp.amount === 'number' ? okOut() : refuse());
    return {
      compute,
      buildArtifact: async (pp) => { if (typeof pp.amount === 'number' && !Number.isSafeInteger(pp.amount)) throw new Error('unsafe'); },
      expect: (r) => r.buildThrows > 0,
    };
  })(),
  // accepts the impossible date 2026-02-31 (regex-only validation)
  acceptsBadDate: {
    compute: (pp) => (/^\d{4}-\d{2}-\d{2}$/.test(pp.period_end_date) ? okOut() : refuse()),
    expect: (r) => (r.cleanBy['bad-date'] ?? 0) > 0,
  },
  // refuses everything that is not exactly the base input: reports clean
  refusesAll: (() => {
    const baseJson = JSON.stringify(SELF_BASE);
    const compute = (pp) => (JSON.stringify(pp) === baseJson && !Object.keys(pp).includes('__proto__') ? okOut() : refuse());
    return { compute, buildArtifact: stdBuild(compute), expect: (r) => r.computeThrows === 0 && r.buildThrows === 0 && r.clean === 0 };
  })(),
};

async function selfTest() {
  let bad = 0;
  for (const [name, k] of Object.entries(PLANTED)) {
    const r = await censusKernel(k, SELF_BASE, { budgetMs: 5000, maxFields: 80 });
    const ok = k.expect(r);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: total=${r.total} throws=${r.computeThrows} build-throws=${r.buildThrows} clean=${r.clean}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\nself-test: ${bad} control(s) FAILED` : '\nself-test: all controls behave (planted defects reported, refusing kernel clean)');
  process.exit(bad ? 1 : 0);
}

// ---------- main ----------

const KERNEL_TIMEOUT_MS = Number(opt('--kernel-timeout-ms', 20000));

function runIsolated(stem) {
  return new Promise((res) => {
    const args = [fileURLToPath(import.meta.url), '--kernel', stem, '--json', '--budget-ms', String(BUDGET_MS), '--max-fields', String(MAX_FIELDS)];
    execFile(process.execPath, args, { encoding: 'utf8', timeout: KERNEL_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1 << 24 }, (err, out) => {
      if (err && (err.killed || err.signal)) return res({ hang: true });
      try { res(JSON.parse(String(out).trim().split(/\r?\n/).pop())); } catch { res({ skip: 'child output unreadable' }); }
    });
  });
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// --kernel <id> --json: one kernel, in-process, machine-readable (used by the isolated runner).
async function jsonOne(stem) {
  const k = await loadKernel(stem);
  if (k.skip) { console.log(JSON.stringify({ skip: k.skip })); return 0; }
  const r = await censusKernel(k.mod, k.base);
  console.log(JSON.stringify(r)); return 0;
}

async function main() {
  if (flag('--self-test')) return selfTest();

  if (flag('--json') && opt('--kernel', null)) return jsonOne(opt('--kernel', null));
  let stems;
  const one = opt('--kernel', null);
  if (one) stems = [one];
  else if (flag('--all')) stems = allKernels();
  else {
    stems = changedKernels(opt('--base', 'origin/main'));
    if (stems === null) { console.log('kernel hostile census (advisory): cannot diff against base; nothing checked'); return 0; }
  }
  if (!stems.length) { console.log('kernel hostile census (advisory): no kernel added or changed; nothing to do'); return 0; }

  const tot = { kernels: 0, skipped: 0, total: 0, computeThrows: 0, buildThrows: 0, clean: 0, cut: 0, withFinding: 0, hangs: 0 };
  const rows = [];
  // One child process per kernel with a hard timeout: a kernel that loops forever on a hostile
  // input (sync code the in-process time-box cannot interrupt) is reported as HANG, not a stall.
  const results = await mapLimit(stems, 4, (stem) => runIsolated(stem));
  stems.forEach((stem, i) => {
    const r = results[i];
    if (r.skip) { tot.skipped++; rows.push(`${stem.padEnd(60)} skipped (${r.skip})`); return; }
    if (r.hang) { tot.hangs++; tot.withFinding++; rows.push(`${stem.padEnd(60)} HANG (no result within ${KERNEL_TIMEOUT_MS} ms)`); return; }
    tot.kernels++; tot.total += r.total; tot.computeThrows += r.computeThrows;
    tot.buildThrows += r.buildThrows; tot.clean += r.clean; if (r.cut) tot.cut++;
    if (r.computeThrows || r.buildThrows) tot.withFinding++;
    rows.push(`${stem.padEnd(60)} n=${String(r.total).padStart(4)} throws=${String(r.computeThrows).padStart(3)} build-throws=${String(r.buildThrows).padStart(3)} clean=${String(r.clean).padStart(3)}${r.cut ? ' [CUT at time-box]' : ''}`);
    for (const [label, key] of [['throws', 'computeThrows'], ['build-throws', 'buildThrows'], ['clean', 'clean']]) {
      if (r.ex[key] && stems.length <= 40) rows.push(`    first ${label}: ${r.ex[key]}`);
    }
  });
  console.log('kernel hostile census (ADVISORY, exit 0; NaN/Infinity excluded)');
  for (const row of rows) console.log(row);
  console.log(`\nTOTALS: kernels=${tot.kernels} skipped=${tot.skipped} variants=${tot.total} compute-throws=${tot.computeThrows} build-throws=${tot.buildThrows} accepted-clean=${tot.clean} kernels-with-throw-or-build-finding=${tot.withFinding} hangs=${tot.hangs} cut-by-time-box=${tot.cut}`);
  // Down-only baseline (advisory): in --all mode, report any total above the committed
  // ceiling. The ceiling may only be lowered by hand; this never changes the exit code.
  if (flag('--all')) {
    try {
      const b = JSON.parse(readFileSync(resolve(HERE, 'kernel-hostile-census-baseline.json'), 'utf8'));
      const over = ['withFinding', 'computeThrows', 'buildThrows', 'hangs'].filter((k) => tot[k] > b[k]);
      console.log(over.length
        ? `BASELINE (advisory): ABOVE ceiling on ${over.join(', ')} (ceiling withFinding=${b.withFinding} compute-throws=${b.computeThrows} build-throws=${b.buildThrows} hangs=${b.hangs})`
        : `BASELINE (advisory): at or below ceiling (withFinding=${b.withFinding} compute-throws=${b.computeThrows} build-throws=${b.buildThrows} hangs=${b.hangs})`);
    } catch { console.log('BASELINE (advisory): no baseline file'); }
  }
  return flag('--strict') && (tot.computeThrows || tot.buildThrows) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => { console.log('kernel hostile census (advisory): internal error: ' + msg(e)); process.exit(flag('--strict') ? 1 : 0); });
}
