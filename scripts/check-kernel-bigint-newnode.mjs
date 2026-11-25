#!/usr/bin/env node
// check-kernel-bigint-newnode.mjs
//
// BigInt never-throw probe for kernels a PR adds or edits. The kernel never-throw rule
// blocks NEW-node PRs; an edited existing kernel is
// held to "no worse than main". The shared proptest shapes (_pbt-common.mjs) deliberately do
// NOT carry BigInt (that would turn every existing kernel red), so this gate carries them.
//
// Probe shapes (built from the kernel's first golden fixture input, or {} when none):
//   top-field:<name>   one variant per top-level field, that field set to 10n
//   unknown-key        an extra top-level key "__bigint_unknown__" set to 10n
//   nested             an extra top-level key "__bigint_nested__" set to { a: [3n] }
// A shape "throws" when compute() or buildArtifact() throws, rejects, or never settles.
//
// NEW node   (shard chaingraph/graph/nodes/<stem>.json ADDED, or kernel absent at base):
//            any throw is a FAIL, blocking (exit 1) locally and on pull_request.
// EDITED     (kernel exists at base and is modified): the same probe runs on origin/main's
//            kernel bytes (git show into a temp dir beside base copies of its relative
//            imports, _hash.mjs included). FAIL only when the head throws on a shape main
//            does not. Both counts are printed. Reported as FAIL-EDITED; exits 1 only with
//            --block-edited (the census it extends is advisory; the edited leg is not wired
//            blocking until the owner flips it).
//
// Usage:
//   node scripts/check-kernel-bigint-newnode.mjs                 kernels changed vs origin/main
//   node scripts/check-kernel-bigint-newnode.mjs --kernel <stem> one kernel (new-node rules,
//                                                                or edited rules with --edited)
//   node scripts/check-kernel-bigint-newnode.mjs --self-test     planted-kernel controls
// Flags: --base <ref> (default origin/main), --block-edited, --timeout-ms <n> (default 15000).

import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, execFile } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KREL = 'chaingraph/kernels';
const SHARD_RE = /^chaingraph\/graph\/nodes\/([^/]+)\.json$/;
const KERNEL_RE = /^chaingraph\/kernels\/([^/_][^/]*)\.kernel\.mjs$/;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TIMEOUT_MS = Number(opt('--timeout-ms', 15000));
const msg = (e) => String(e && e.message ? e.message : e).slice(0, 90);

// ---------- probe ----------

export function bigintShapes(base) {
  const shapes = [];
  const root = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
  for (const k of Object.keys(root)) {
    shapes.push({ key: `top-field:${k}`, make: () => ({ ...structuredClone(root), [k]: 10n }) });
  }
  shapes.push({ key: 'unknown-key', make: () => ({ ...structuredClone(root), __bigint_unknown__: 10n }) });
  shapes.push({ key: 'nested', make: () => ({ ...structuredClone(root), __bigint_nested__: { a: [3n] } }) });
  return shapes;
}

const settle = (p) => Promise.race([
  Promise.resolve(p),
  new Promise((_, rej) => setTimeout(() => rej(new Error('did not settle')), 4000).unref()),
]);

// Returns { shapes: n, throws: { <shapeKey>: message } }
export async function probeKernel(mod, base) {
  const out = { shapes: 0, throws: {} };
  for (const s of bigintShapes(base)) {
    out.shapes++;
    try {
      if (typeof mod.compute === 'function') await settle(mod.compute(s.make()));
      if (typeof mod.buildArtifact === 'function') await settle(mod.buildArtifact(s.make(), { now: '2026-01-01T00:00:00Z' }));
    } catch (e) { out.throws[s.key] = msg(e); }
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

function fixtureBase(stem) {
  const fx = resolve(ROOT, KREL, 'fixtures', `${stem}.fixtures.json`);
  if (!existsSync(fx)) return {};
  try { return JSON.parse(readFileSync(fx, 'utf8')).vectors?.[0]?.policy_parameters ?? {}; } catch { return {}; }
}

// --probe-file <kernel path> --stem <stem>: in-process probe, one JSON line.
async function probeChild(file, stem) {
  let mod;
  try { mod = await import(pathToFileURL(file).href); } catch (e) { console.log(JSON.stringify({ skip: 'import failed: ' + msg(e) })); return 0; }
  console.log(JSON.stringify(await probeKernel(mod, fixtureBase(stem))));
  return 0;
}

function runChild(file, stem) {
  return new Promise((res) => {
    const args = [fileURLToPath(import.meta.url), '--probe-file', file, '--stem', stem];
    execFile(process.execPath, args, { encoding: 'utf8', timeout: TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1 << 24 }, (err, out) => {
      if (err && (err.killed || err.signal)) return res({ skip: `hang (no result within ${TIMEOUT_MS} ms)` });
      try { res(JSON.parse(String(out).trim().split(/\r?\n/).pop())); } catch { res({ skip: 'child output unreadable' }); }
    });
  });
}

// ---------- self-test: planted kernels ----------

const FX_BASE = { amount: 100, mode: 'strict' };
const PLANTED = {
  // New node whose buildArtifact serializes pp raw: throws on BigInt like the P3 class.
  newThrows: { kind: 'new', mod: { compute: () => ({ ok: true }), buildArtifact: async (pp) => JSON.stringify(pp) }, expectFail: true },
  // New node with a refusal branch: refuses any non-plain-JSON value, never throws.
  newRefuses: {
    kind: 'new',
    mod: {
      compute: (pp) => (JSON.stringify(pp, (k, v) => (typeof v === 'bigint' ? '__bigint__' : v)).includes('__bigint__') ? { refused: true } : { ok: true }),
      buildArtifact: async (pp) => ({ refused: JSON.stringify(pp, (k, v) => (typeof v === 'bigint' ? '__bigint__' : v)).includes('__bigint__') }),
    },
    expectFail: false,
  },
  // Edited kernel: head and main both throw on every shape.
  editedLikeMain: { kind: 'edited', mod: { compute: () => ({ ok: true }), buildArtifact: async (pp) => JSON.stringify(pp) }, main: { compute: () => ({ ok: true }), buildArtifact: async (pp) => JSON.stringify(pp) }, expectFail: false },
  // Edited kernel: main handles BigInt, head throws on it.
  editedNewlyThrows: { kind: 'edited', mod: { compute: () => ({ ok: true }), buildArtifact: async (pp) => JSON.stringify(pp) }, main: { compute: () => ({ ok: true }), buildArtifact: async () => ({ ok: true }) }, expectFail: true },
};

async function selfTest() {
  let bad = 0;
  for (const [name, k] of Object.entries(PLANTED)) {
    const head = await probeKernel(k.mod, FX_BASE);
    const main = k.main ? await probeKernel(k.main, FX_BASE) : null;
    const v = verdict(k.kind, head, main);
    const ok = v.fail === k.expectFail;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} (${k.kind}): head-throws=${v.headCount}${main ? ` main-throws=${v.mainCount}` : ''} newly=${v.newly.length} verdict=${v.fail ? 'FAIL' : 'pass'}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\nself-test: ${bad} control(s) FAILED` : `\nself-test: ${Object.keys(PLANTED).length}/${Object.keys(PLANTED).length} controls behave`);
  return bad ? 1 : 0;
}

// ---------- main ----------

async function checkOne({ stem, kind }, base) {
  const headFile = resolve(ROOT, KREL, `${stem}.kernel.mjs`);
  const head = await runChild(headFile, stem);
  if (head.skip) return { stem, kind, skip: head.skip };
  let main = null;
  if (kind === 'edited') {
    const dir = mkdtempSync(join(tmpdir(), 'bigint-base-'));
    try {
      const baseFile = stageBase(base, stem, dir);
      main = await runChild(baseFile, stem);
    } finally { rmSync(dir, { recursive: true, force: true }); }
    if (main.skip) return { stem, kind, skip: 'base kernel: ' + main.skip };
  }
  return { stem, kind, head, main, v: verdict(kind, head, main) };
}

async function main() {
  if (flag('--self-test')) return selfTest();
  if (opt('--probe-file', null)) return probeChild(opt('--probe-file', null), opt('--stem', ''));
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
    const counts = `head-throws=${r.v.headCount}/${r.head.shapes}` + (r.main ? ` main-throws=${r.v.mainCount}/${r.main.shapes}` : '');
    if (r.v.fail && r.kind === 'new') { blocking++; console.log(`${r.stem}  [new]  FAIL  ${counts}`); }
    else if (r.v.fail) { if (flag('--block-edited')) blocking++; else advisory++; console.log(`${r.stem}  [edited]  FAIL-EDITED${flag('--block-edited') ? '' : ' (advisory)'}  ${counts}`); }
    else console.log(`${r.stem}  [${r.kind}]  pass  ${counts}`);
    if (r.v.fail) for (const k of r.v.newly.slice(0, 3)) console.log(`    ${k}: ${r.head.throws[k]}`);
  }
  console.log(`\nTOTALS: kernels=${results.length} blocking-fails=${blocking} advisory-fails=${advisory}`);
  return blocking ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => { console.log('kernel bigint gate: internal error: ' + msg(e)); process.exit(1); });
}
