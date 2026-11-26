#!/usr/bin/env node
// check-kernel-bigint-newnode.mjs
//
// BigInt never-throw probe for kernels a PR adds or edits. The kernel never-throw rule
// blocks NEW-node PRs; an edited existing kernel is
// held to "no worse than main". The shared proptest shapes (_pbt-common.mjs) deliberately do
// NOT carry BigInt (that would turn every existing kernel red), so this gate carries them.
//
// Probe inputs come from the kernel's golden fixture cases (fixtures/<stem>.fixtures.json):
//   base     the richest NON-EMPTY policy_parameters object (most top-level keys, earliest on a
//            tie). About 1 in 7 fixture files open with an empty {} case, so taking case 0 would
//            leave no fields to probe. {} only when no case carries any field.
//   fields   every top-level key seen in ANY non-empty case, each built on the richest case
//            that carries it, so a field that only appears in a later case is still probed.
// Probe shapes:
//   top-field:<name>   one variant per field, that field set to 10n
//   unknown-key        base plus an extra top-level key "__bigint_unknown__" set to 10n
//   nested             base plus an extra top-level key "__bigint_nested__" set to { a: [3n] }
// A shape "throws" when compute() or buildArtifact() throws, rejects, never settles, spins
// without returning (no result within --timeout-ms), or kills the probe process. A shape that
// hangs or kills the process is recorded against that shape and the probe restarts on the
// shapes not yet run, so one hang neither hides the remaining shapes nor reads as a pass.
//
// NEW node   (shard chaingraph/graph/nodes/<stem>.json ADDED, or kernel absent at base):
//            any throw (hangs included) is a FAIL, blocking (exit 1) locally and on pull_request.
// EDITED     (kernel exists at base and is modified): the same probe runs on origin/main's
//            kernel bytes (git show into a temp dir beside base copies of its relative
//            imports, _hash.mjs included). FAIL only when the head throws on a shape main
//            does not. Both counts are printed. Reported as FAIL-EDITED; exits 1 only with
//            --block-edited (the census it extends is advisory; the edited leg is not wired
//            blocking until the owner flips it).
// SKIPPED    only when the kernel module cannot be imported at all (a broken import is other
//            gates' business; a kernel that never finishes importing is a hang and FAILs).
//
// Usage:
//   node scripts/check-kernel-bigint-newnode.mjs                 kernels changed vs origin/main
//   node scripts/check-kernel-bigint-newnode.mjs --kernel <stem> one kernel (new-node rules,
//                                                                or edited rules with --edited)
//   node scripts/check-kernel-bigint-newnode.mjs --self-test     planted-kernel controls
// Flags: --base <ref> (default origin/main), --block-edited, --timeout-ms <n> (default 15000:
//        how long one shape, or the kernel import, may run without a result before it counts
//        as a hang; a slow kernel that keeps finishing shapes is never cut off).

import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync, writeSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SELF = fileURLToPath(import.meta.url);
const KREL = 'chaingraph/kernels';
const SHARD_RE = /^chaingraph\/graph\/nodes\/([^/]+)\.json$/;
const KERNEL_RE = /^chaingraph\/kernels\/([^/_][^/]*)\.kernel\.mjs$/;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TIMEOUT_MS = Number(opt('--timeout-ms', 15000));
const NEW_NODE_MAX_HANGS = 3;
const msg = (e) => String(e && e.message ? e.message : e).slice(0, 90);
const isPlain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// ---------- inputs ----------

// From a fixture file's vectors, pick the probe base and the source case for every field.
// Returns { base: object, fields: Map<fieldName, sourceCase> } (Map, so a "__proto__" key is data).
export function fixturePlan(vectors) {
  const cases = (Array.isArray(vectors) ? vectors : [])
    .map((v) => (v ? v.policy_parameters : undefined))
    .filter((pp) => isPlain(pp) && Object.keys(pp).length > 0);
  const ranked = cases
    .map((pp, i) => ({ pp, i }))
    .sort((a, b) => Object.keys(b.pp).length - Object.keys(a.pp).length || a.i - b.i)
    .map((x) => x.pp);
  const fields = new Map();
  for (const pp of ranked) for (const k of Object.keys(pp)) if (!fields.has(k)) fields.set(k, pp);
  return { base: ranked[0] ?? {}, fields };
}

export function readFixturePlan(path) {
  if (!path || !existsSync(path)) return fixturePlan([]);
  try { return fixturePlan(JSON.parse(readFileSync(path, 'utf8')).vectors); } catch { return fixturePlan([]); }
}

const fixturesPath = (stem) => resolve(ROOT, KREL, 'fixtures', `${stem}.fixtures.json`);

// Accepts a fixturePlan() result or, for callers that only have one input, a plain base object.
const normPlan = (p) => (p && p.fields instanceof Map ? p : { base: isPlain(p) ? p : {}, fields: null });

// ---------- probe ----------

export function bigintShapes(plan) {
  const { base, fields } = normPlan(plan);
  const src = fields ?? new Map(Object.keys(base).map((k) => [k, base]));
  const shapes = [];
  for (const [k, from] of src) {
    shapes.push({ key: `top-field:${k}`, make: () => ({ ...structuredClone(from), [k]: 10n }) });
  }
  shapes.push({ key: 'unknown-key', make: () => ({ ...structuredClone(base), __bigint_unknown__: 10n }) });
  shapes.push({ key: 'nested', make: () => ({ ...structuredClone(base), __bigint_nested__: { a: [3n] } }) });
  return shapes;
}

const settle = (p) => Promise.race([
  Promise.resolve(p),
  new Promise((_, rej) => setTimeout(() => rej(new Error('did not settle')), 4000).unref()),
]);

// Let callbacks a shape scheduled (timers, immediates, stray rejections) run before the shape is
// called done, so a crash they cause lands on the shape that caused it.
const drain = () => new Promise((r) => setTimeout(r, 0)).then(() => new Promise((r) => setImmediate(r)));

// Returns { shapes: n, throws: { <shapeKey>: message } }
// opts.skip: shape keys not to run (still counted); opts.emit: progress events (child mode).
export async function probeKernel(mod, plan, { skip = null, emit = null } = {}) {
  const out = { shapes: 0, throws: {} };
  for (const s of bigintShapes(plan)) {
    out.shapes++;
    if (skip && skip.has(s.key)) continue;
    if (emit) emit({ start: s.key });
    try {
      if (typeof mod.compute === 'function') await settle(mod.compute(s.make()));
      if (typeof mod.buildArtifact === 'function') await settle(mod.buildArtifact(s.make(), { now: '2026-01-01T00:00:00Z' }));
    } catch (e) { out.throws[s.key] = msg(e); }
    if (emit) { await drain(); emit({ done: s.key, threw: out.throws[s.key] ?? null }); }
  }
  return out;
}

// Verdict from a head probe and (for edited kernels) a main probe.
export function verdict(kind, head, main) {
  const headKeys = Object.keys(head.throws);
  if (kind === 'new') return { fail: headKeys.length > 0, newly: headKeys, headCount: headKeys.length };
  const mainKeys = new Set(Object.keys(main.throws));
  const newly = headKeys.filter((k) => !mainKeys.has(k));
  return { fail: newly.length > 0, newly, headCount: headKeys.length, mainCount: mainKeys.size };
}

// ---------- git helpers ----------

const git = (args, opts = {}) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', env: gitEnv(), maxBuffer: 1 << 26, ...opts });
const gitOk = (args) => { try { git(args, { stdio: 'pipe' }); return true; } catch { return false; } };

function classify(base) {
  let rows;
  try { rows = git(['diff', '--name-status', '--diff-filter=AM', `${base}...HEAD`]).split('\n').filter(Boolean); } catch { return null; }
  const addedShards = new Set(); const kernels = new Set();
  for (const r of rows) {
    const [st, f] = r.split('\t');
    const sm = SHARD_RE.exec(f); if (sm && st === 'A') addedShards.add(sm[1]);
    const km = KERNEL_RE.exec(f); if (km) kernels.add(km[1]);
  }
  const items = [];
  for (const stem of kernels) {
    const isNew = addedShards.has(stem) || !gitOk(['cat-file', '-e', `${base}:${KREL}/${stem}.kernel.mjs`]);
    items.push({ stem, kind: isNew ? 'new' : 'edited' });
  }
  for (const stem of addedShards) {
    // A new shard whose kernel file is not in the diff still has to be probed if the kernel exists.
    if (!kernels.has(stem) && existsSync(resolve(ROOT, KREL, `${stem}.kernel.mjs`))) items.push({ stem, kind: 'new' });
  }
  return items.sort((a, b) => a.stem.localeCompare(b.stem));
}

// Copy base bytes of a kernel plus its relative imports (recursively) into dir/chaingraph-shape.
function stageBase(base, stem, dir) {
  const seen = new Set();
  const fetchFile = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    let text;
    try { text = git(['show', `${base}:${rel}`]); } catch { return; }
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const next = join(dirname(rel), m[1]).replace(/\\/g, '/');
      fetchFile(next);
    }
  };
  fetchFile(`${KREL}/${stem}.kernel.mjs`);
  fetchFile(`${KREL}/_hash.mjs`);
  return join(dir, KREL, `${stem}.kernel.mjs`);
}

// ---------- child runner ----------

// --probe-file <kernel> --fixtures <path> --skip <json array>: in-process probe that streams one
// JSON event per line: {imported} | {start} | {done, threw} | {end, shapes} | {skip}.
// writeSync so no event is lost if the kernel or the exit path cuts the process short.
async function probeChild(file, fixtures, skipJson) {
  const say = (o) => writeSync(1, JSON.stringify(o) + '\n');
  let mod;
  try { mod = await import(pathToFileURL(file).href); } catch (e) { say({ skip: 'import failed: ' + msg(e) }); return 0; }
  say({ imported: true });
  let skip = [];
  try { skip = JSON.parse(skipJson || '[]'); } catch { /* run everything */ }
  const out = await probeKernel(mod, readFixturePlan(fixtures), { skip: new Set(skip), emit: say });
  say({ end: true, shapes: out.shapes });
  return 0;
}

// One child process. It is killed when it goes idleMs without a progress event.
function runChild(file, fixtures, skip, idleMs) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [SELF, '--probe-file', file, '--fixtures', fixtures, '--skip', JSON.stringify([...skip])], { stdio: ['ignore', 'pipe', 'pipe'] });
    const events = []; let buf = ''; let stderr = ''; let timedOut = false; let timer = null;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, idleMs); };
    arm();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let ev; try { ev = JSON.parse(line); } catch { continue; } // the kernel's own console output
        if (isPlain(ev) && ('imported' in ev || 'start' in ev || 'done' in ev || 'end' in ev || 'skip' in ev)) { events.push(ev); arm(); }
      }
      if (buf.length > 1 << 20) buf = ''; // a kernel printing without newlines
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); res({ events, timedOut, code: null, signal: null, stderr: msg(e) }); });
    child.on('close', (code, signal) => { clearTimeout(timer); res({ events, timedOut, code, signal, stderr }); });
  });
}

const lastErrLine = (s) => {
  const l = String(s || '').split(/\r?\n/).map((x) => x.trim()).filter((x) => /Error|throw/i.test(x)).pop();
  return l ? `: ${l.slice(0, 70)}` : '';
};

// Probe a kernel file across as many child processes as it takes. A shape that hangs or kills
// the child is recorded as a throw on that shape and the probe restarts on the remaining shapes.
// maxHangs: stop after that many hangs (each costs idleMs). Used for new nodes, whose verdict is
// already FAIL by then; edited kernels run every shape so the comparison with main stays exact.
// Returns { shapes, throws, hangs: [shapeKey], unprobed } or { skip }.
export async function runProbe(file, fixtures, idleMs = TIMEOUT_MS, maxHangs = Infinity) {
  const throws = {}; const hangs = []; const finished = new Set();
  for (let pass = 0; pass < 1000; pass++) {
    const r = await runChild(file, fixtures, finished, idleMs);
    let imported = false; let current = null;
    for (const ev of r.events) {
      if ('skip' in ev) return { skip: ev.skip };
      if ('imported' in ev) imported = true;
      else if ('start' in ev) current = ev.start;
      else if ('done' in ev) { if (ev.threw) throws[ev.done] = ev.threw; finished.add(ev.done); current = null; }
      else if ('end' in ev) return { shapes: ev.shapes, throws, hangs, unprobed: 0 };
    }
    const why = r.timedOut ? `hang (no result within ${idleMs} ms)` : `probe process died (${r.signal || 'exit ' + r.code})${lastErrLine(r.stderr)}`;
    if (!imported) {
      // The kernel never finished importing: spinning at module top level is a hang (FAIL);
      // anything else we cannot read stays a SKIP, as before.
      if (r.timedOut) return { shapes: 1, throws: { import: why }, hangs: ['import'], unprobed: 0 };
      return { skip: 'child output unreadable: ' + why };
    }
    if (current === null) return { skip: 'probe stopped between shapes: ' + why };
    throws[current] = why;
    if (r.timedOut) hangs.push(current);
    finished.add(current);
    if (hangs.length >= maxHangs) {
      const shapes = bigintShapes(readFixturePlan(fixtures)).length;
      return { shapes, throws, hangs, unprobed: Math.max(0, shapes - finished.size) };
    }
  }
  return { skip: 'probe restarted too many times' };
}

// ---------- self-test: planted kernels ----------

// In-process controls (no hangs possible): verdict logic and fixture-case selection.
const FX_VECTORS = [{ policy_parameters: { amount: 100, mode: 'strict' } }];
const serializeRaw = { compute: () => ({ ok: true }), buildArtifact: async (pp) => JSON.stringify(pp) };
const refuses = {
  compute: (pp) => (JSON.stringify(pp, (k, v) => (typeof v === 'bigint' ? '__bigint__' : v)).includes('__bigint__') ? { refused: true } : { ok: true }),
  buildArtifact: async (pp) => ({ refused: JSON.stringify(pp, (k, v) => (typeof v === 'bigint' ? '__bigint__' : v)).includes('__bigint__') }),
};
// Throws only when one named field carries a BigInt; refuses everything else.
const throwsOnField = (field) => ({
  compute: (pp) => (typeof pp[field] === 'bigint' ? JSON.stringify(pp) : refuses.compute(pp)),
  buildArtifact: refuses.buildArtifact,
});

const PLANTED = {
  // New node whose buildArtifact serializes pp raw: throws on BigInt like the P3 class.
  newThrows: { kind: 'new', vectors: FX_VECTORS, mod: serializeRaw, expectFail: true },
  // New node with a refusal branch: refuses any non-plain-JSON value, never throws.
  newRefuses: { kind: 'new', vectors: FX_VECTORS, mod: refuses, expectFail: false },
  // Edited kernel: head and main both throw on every shape.
  editedLikeMain: { kind: 'edited', vectors: FX_VECTORS, mod: serializeRaw, main: serializeRaw, expectFail: false },
  // Edited kernel: main handles BigInt, head throws on it.
  editedNewlyThrows: { kind: 'edited', vectors: FX_VECTORS, mod: serializeRaw, main: { compute: () => ({ ok: true }), buildArtifact: async () => ({ ok: true }) }, expectFail: true },
  // First fixture case is {} (art-584, art-604 shape). The throwing field lives in case 1; taking
  // case 0 as the base would probe no fields and pass.
  emptyFirstCase: { kind: 'new', vectors: [{ policy_parameters: {} }, { policy_parameters: { amount: 100, mode: 'strict' } }], mod: throwsOnField('amount'), expectFail: true, expectKeys: ['top-field:amount'], caseZeroWouldPass: true },
  // The throwing field only appears in a smaller, later case (art-857's optional fields).
  laterCaseField: { kind: 'new', vectors: [{ policy_parameters: { a: 1, b: 2 } }, { policy_parameters: { c: 3 } }], mod: throwsOnField('c'), expectFail: true, expectKeys: ['top-field:c'] },
  // Every case empty: no fields to probe, only the two extra-key shapes, and a clean kernel passes.
  allCasesEmpty: { kind: 'new', vectors: [{ policy_parameters: {} }], mod: refuses, expectFail: false, expectShapes: 2 },
};

// Child-process controls: planted kernel files, so hangs and crashes are real.
const KSRC = {
  // Spins forever on the unknown-key shape, throws on nested, refuses the rest. Shows the hang is
  // a throw on its own shape and the shapes after it are still probed.
  hangs: `const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function compute(pp) { if (has(pp, '__bigint_unknown__')) { for (;;) {} } if (has(pp, '__bigint_nested__')) throw new Error('nested BigInt'); return { refused: true }; }
export async function buildArtifact() { return { refused: true }; }`,
  // About 0.6 s per shape, three shapes: longer than the 1 s idle limit in total, never idle for 1 s.
  slow: `const spin = (ms) => { const t = Date.now() + ms; while (Date.now() < t) {} };
export function compute() { spin(300); return { refused: true }; }
export async function buildArtifact() { spin(300); return { refused: true }; }`,
  // Kills its own process from a callback scheduled on the nested shape.
  crashes: `export function compute(pp) { if (pp.__bigint_nested__) setImmediate(() => { throw new Error('async boom'); }); return { refused: true }; }
export async function buildArtifact() { return { refused: true }; }`,
  clean: `export function compute() { return { refused: true }; }
export async function buildArtifact() { return { refused: true }; }`,
  // Spins on every BigInt shape.
  hangsAll: `const big = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? '__b__' : v)).includes('__b__');
export function compute(pp) { if (big(pp)) { for (;;) {} } return { refused: true }; }
export async function buildArtifact() { return { refused: true }; }`,
  // Spins at module top level: never finishes importing.
  hangsOnImport: `for (;;) {}
export function compute() { return {}; }`,
};
const CHILD_PLANTED = {
  newHangs: { kind: 'new', head: 'hangs', expectFail: true, expectKeys: ['unknown-key', 'nested'], expectHangs: ['unknown-key'] },
  newSlowButFinishes: { kind: 'new', head: 'slow', expectFail: false },
  newCrashes: { kind: 'new', head: 'crashes', expectFail: true, expectKeys: ['nested'] },
  newHangsEverywhereCapped: { kind: 'new', head: 'hangsAll', maxHangs: 2, expectFail: true, expectHangs: ['top-field:amount', 'unknown-key'], expectUnprobed: 1 },
  newHangsOnImport: { kind: 'new', head: 'hangsOnImport', expectFail: true, expectKeys: ['import'] },
  editedNewlyHangs: { kind: 'edited', head: 'hangs', main: 'clean', expectFail: true },
  editedHangsLikeMain: { kind: 'edited', head: 'hangs', main: 'hangs', expectFail: false },
};
const CHILD_IDLE_MS = 1000;

function check(name, k, head, main, v) {
  const sameKeys = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const problems = [];
  if (v.fail !== k.expectFail) problems.push(`verdict ${v.fail ? 'FAIL' : 'pass'}, expected ${k.expectFail ? 'FAIL' : 'pass'}`);
  if (k.expectKeys && !sameKeys(Object.keys(head.throws), k.expectKeys)) problems.push(`throws on [${Object.keys(head.throws)}], expected [${k.expectKeys}]`);
  if (k.expectHangs && !sameKeys(head.hangs || [], k.expectHangs)) problems.push(`hangs on [${head.hangs || []}], expected [${k.expectHangs}]`);
  if (k.expectUnprobed != null && head.unprobed !== k.expectUnprobed) problems.push(`${head.unprobed} unprobed, expected ${k.expectUnprobed}`);
  if (k.expectShapes != null && head.shapes !== k.expectShapes) problems.push(`${head.shapes} shapes, expected ${k.expectShapes}`);
  const hangNote = (head.hangs && head.hangs.length ? ` hangs=${head.hangs.length}` : '') + (head.unprobed ? ` unprobed=${head.unprobed}` : '');
  console.log(`  ${problems.length ? 'FAIL' : 'PASS'}  ${name} (${k.kind}): shapes=${head.shapes} head-throws=${v.headCount}${main ? ` main-throws=${v.mainCount}` : ''}${hangNote} newly=${v.newly.length} verdict=${v.fail ? 'FAIL' : 'pass'}${problems.length ? '  <- ' + problems.join('; ') : ''}`);
  return problems.length;
}

async function selfTest() {
  let bad = 0; let n = 0;
  for (const [name, k] of Object.entries(PLANTED)) {
    n++;
    const plan = fixturePlan(k.vectors);
    const head = await probeKernel(k.mod, plan);
    const main = k.main ? await probeKernel(k.main, plan) : null;
    bad += check(name, k, head, main, verdict(k.kind, head, main));
    if (k.caseZeroWouldPass) {
      // RED control for the old input rule: base = first case only.
      n++;
      const old = await probeKernel(k.mod, k.vectors[0].policy_parameters);
      const ok = verdict(k.kind, old, null).fail === false;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}/case-0-only: the old first-case rule probes ${old.shapes} shapes and ${ok ? 'misses the throw (as the fix expects)' : 'catches the throw (control is not testing the fix)'}`);
      if (!ok) bad++;
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'bigint-selftest-'));
  try {
    const fx = join(dir, 'planted.fixtures.json');
    writeFileSync(fx, JSON.stringify({ vectors: [{ policy_parameters: {} }, { policy_parameters: { amount: 100 } }] }));
    const file = (which) => { const p = join(dir, `${which}.kernel.mjs`); if (!existsSync(p)) writeFileSync(p, KSRC[which]); return p; };
    for (const [name, k] of Object.entries(CHILD_PLANTED)) {
      n++;
      const head = await runProbe(file(k.head), fx, CHILD_IDLE_MS, k.maxHangs ?? Infinity);
      const main = k.main ? await runProbe(file(k.main), fx, CHILD_IDLE_MS) : null;
      if (head.skip || (main && main.skip)) { console.log(`  FAIL  ${name}: probe SKIPPED (${head.skip || main.skip})`); bad++; continue; }
      bad += check(name, k, head, main, verdict(k.kind, head, main));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(bad ? `\nself-test: ${bad} control(s) FAILED` : `\nself-test: ${n}/${n} controls behave`);
  return bad ? 1 : 0;
}

// ---------- main ----------

async function checkOne({ stem, kind }, base) {
  const headFile = resolve(ROOT, KREL, `${stem}.kernel.mjs`);
  const fx = fixturesPath(stem);
  const head = await runProbe(headFile, fx, TIMEOUT_MS, kind === 'new' ? NEW_NODE_MAX_HANGS : Infinity);
  if (head.skip) return { stem, kind, skip: head.skip };
  let main = null;
  if (kind === 'edited') {
    const dir = mkdtempSync(join(tmpdir(), 'bigint-base-'));
    try {
      const baseFile = stageBase(base, stem, dir);
      main = await runProbe(baseFile, fx);
    } finally { rmSync(dir, { recursive: true, force: true }); }
    if (main.skip) return { stem, kind, skip: 'base kernel: ' + main.skip };
  }
  return { stem, kind, head, main, v: verdict(kind, head, main) };
}

async function main() {
  if (flag('--self-test')) return selfTest();
  if (opt('--probe-file', null)) return probeChild(opt('--probe-file', null), opt('--fixtures', ''), opt('--skip', '[]'));
  const base = opt('--base', 'origin/main');
  let items;
  const one = opt('--kernel', null);
  if (one) items = [{ stem: one, kind: flag('--edited') ? 'edited' : 'new' }];
  else {
    items = classify(base);
    if (items === null) { console.log('kernel bigint gate: cannot diff against base; nothing checked'); return 0; }
  }
  if (!items.length) { console.log('kernel bigint gate: no kernel added or edited; nothing to do'); return 0; }
  let blocking = 0, advisory = 0;
  const results = [];
  for (const it of items) results.push(await checkOne(it, base));
  console.log('kernel bigint never-throw gate (new node = blocking; edited = no worse than main)');
  for (const r of results) {
    if (r.skip) { console.log(`${r.stem}  [${r.kind}]  SKIPPED (${r.skip})`); continue; }
    const hangs = (p) => (p.hangs && p.hangs.length ? ` hangs=${p.hangs.length}` : '');
    const counts = `head-throws=${r.v.headCount}/${r.head.shapes}${hangs(r.head)}` + (r.main ? ` main-throws=${r.v.mainCount}/${r.main.shapes}${hangs(r.main)}` : '')
      + (r.head.unprobed ? `  (stopped after ${r.head.hangs.length} hangs; ${r.head.unprobed} shape(s) not run)` : '');
    if (r.v.fail && r.kind === 'new') { blocking++; console.log(`${r.stem}  [new]  FAIL  ${counts}`); }
    else if (r.v.fail) { if (flag('--block-edited')) blocking++; else advisory++; console.log(`${r.stem}  [edited]  FAIL-EDITED${flag('--block-edited') ? '' : ' (advisory)'}  ${counts}`); }
    else console.log(`${r.stem}  [${r.kind}]  pass  ${counts}`);
    if (r.v.fail) {
      for (const k of r.v.newly.slice(0, 5)) console.log(`    ${k}: ${r.head.throws[k]}`);
      if (r.v.newly.length > 5) console.log(`    ... and ${r.v.newly.length - 5} more`);
    }
  }
  console.log(`\nTOTALS: kernels=${results.length} blocking-fails=${blocking} advisory-fails=${advisory}`);
  return blocking ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main().then((c) => process.exit(c), (e) => { console.log('kernel bigint gate: internal error: ' + msg(e)); process.exit(1); });
}
