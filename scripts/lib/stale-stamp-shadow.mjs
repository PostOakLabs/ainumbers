// stale-stamp-shadow.mjs - STALE-STAMP-QUICK-WIRE-1. A report-only SHADOW leg for `preflight --quick`.
// It runs the section 17 shard check and `stamp-writers --check` after the quick gates and only LOGS.
// It is not a gate: no result, error, timeout or exception may change preflight's exit code.
// Sunset: SHADOW_UNTIL. Turning it blocking is a later decision for Tim.
//
//   node scripts/lib/stale-stamp-shadow.mjs --self-test

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { gitEnv } from '../_git-env-lib.mjs';
import { fileURLToPath } from 'node:url';

export const SHADOW_UNTIL = '2026-12-01T23:59:59Z';
export const CAP_MS = 20_000; // total added wall per push
export const MAX_IDS = 5;
const KERNEL_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;
const PAGE_RE = /^chaingraph\/([^/]+)\.html$/;

const sha = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null);

// Child run with a hard kill at timeoutMs. Resolves {exit, ms, timedOut, out}; never rejects.
export function runChild(cmdArgs, cwd, timeoutMs) {
  return new Promise((done) => {
    const t0 = Date.now();
    let out = '';
    let timedOut = false;
    let settled = false;
    const fin = (exit) => { if (!settled) { settled = true; clearTimeout(timer); done({ exit, ms: Date.now() - t0, timedOut, out }); } };
    let child;
    try { child = spawn(process.execPath, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch { return done({ exit: -1, ms: 0, timedOut: false, out: '' }); }
    const timer = setTimeout(() => {
      timedOut = true;
      try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); else child.kill('SIGKILL'); } catch { /* best effort */ }
      setTimeout(() => fin(-1), 200);
    }, Math.max(1, timeoutMs));
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', () => fin(-1));
    child.on('close', (code) => fin(code ?? -1));
  });
}

function gitLines(repo, args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: gitEnv() });
  return r.status === 0 ? r.stdout.split('\n').map((s) => s.replace(/\r$/, '')).filter(Boolean) : null;
}

// Touched kernel / node-page ids: committed diff vs ref, plus working-tree changes.
export function deriveIds(repo, ref) {
  const rel = new Set([...(gitLines(repo, ['diff', '--name-only', `${ref}...HEAD`]) || []), ...(gitLines(repo, ['diff', '--name-only']) || []), ...(gitLines(repo, ['diff', '--name-only', '--cached']) || []), ...(gitLines(repo, ['ls-files', '--others', '--exclude-standard']) || [])]);
  const ids = new Set();
  for (const f of rel) {
    const m = f.match(KERNEL_RE) || f.match(PAGE_RE);
    if (m && existsSync(resolve(repo, 'chaingraph', 'kernels', `${m[1]}.kernel.mjs`))) ids.add(m[1]);
  }
  return [...ids].sort();
}

// Log dir: <workspace>/logs/stale-stamp-shadow only when <workspace>/logs exists, else os.tmpdir(). Never in the repo.
export function logPath(repo, tmp = tmpdir()) {
  try {
    const gc = spawnSync('git', ['-C', repo, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', env: gitEnv() }).stdout.trim();
    const ws = dirname(dirname(resolve(repo, gc)));
    if (existsSync(resolve(ws, 'logs'))) return resolve(ws, 'logs', 'stale-stamp-shadow', 'pre-push.jsonl');
  } catch { /* fall through */ }
  return resolve(tmp, 'stale-stamp-shadow', 'pre-push.jsonl');
}

// Files stamp-writers --check may touch for an id.
const touchables = (repo, id) => [
  `chaingraph/${id}.html`, `manifests/${id}.manifest.json`, `chaingraph/graph/nodes/${id}.json`,
  `chaingraph/kernels/__proptests__/${id}.proptest.mjs`, `chaingraph/kernels/fixtures/${id}.fixtures.json`,
].map((r) => resolve(repo, r));

/**
 * Run the shadow leg. NEVER throws, never exits. Returns the record that was logged.
 * opts (all injectable for the selftest): repo, ref, now, ids, run(cmdArgs,cwd,timeoutMs), log(path,line), print(line), head, capMs
 */
export async function runShadow(opts = {}) {
  const repo = opts.repo;
  const now = opts.now || (() => new Date());
  const run = opts.run || runChild;
  const capMs = opts.capMs ?? CAP_MS;
  const print = opts.print || ((l) => console.log(l));
  const rec = { at: now().toISOString(), head: opts.head ?? null, verdict: 'error', kernel_identity: null, stamp_writers: null, timed_out: false };
  const t0 = Date.now();
  try {
    if (!opts.head) rec.head = (spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: gitEnv() }).stdout || '').trim() || null;
    if (now().getTime() > Date.parse(SHADOW_UNTIL)) rec.verdict = 'expired';
    else {
      const ids = opts.ids ? opts.ids : deriveIds(repo, opts.ref || 'origin/main');
      if (!ids.length) rec.verdict = 'skipped-no-kernel';
      else if (ids.length > MAX_IDS) rec.verdict = 'skipped-too-many';
      else {
        const left = () => Math.max(0, capMs - (Date.now() - t0));
        // 1. read-only section 17 shard check
        const ki = await run(['chaingraph/kernels/gen-kernel-identity.mjs', '--check', '--shard'], repo, left());
        rec.kernel_identity = { exit: ki.exit, ms: ki.ms };
        if (ki.timedOut) rec.timed_out = true;
        // 2. stamp-writers --check: snapshot every file it may touch, restore after, then verify.
        if (rec.timed_out || left() < 500) { rec.stamp_writers = rec.timed_out ? 'skipped-cap' : 'skipped-cap'; }
        else {
          const files = ids.flatMap((id) => touchables(repo, id));
          const snap = new Map(files.map((f) => [f, existsSync(f) ? readFileSync(f) : null]));
          const before = new Map(files.map((f) => [f, sha(f)]));
          const porcBefore = (gitLines(repo, ['status', '--porcelain']) || []).join('\n');
          const sw = await run(['scripts/stamp-writers.mjs', '--check', '--base', opts.ref || 'origin/main', '--ids', ids.join(',')], repo, left());
          let restored = 0;
          for (const [f, buf] of snap) {
            if (sha(f) !== before.get(f)) { restored++; try { if (buf === null) rmSync(f, { force: true }); else writeFileSync(f, buf); } catch { /* verified below */ } }
          }
          const porcAfter = (gitLines(repo, ['status', '--porcelain']) || []).join('\n');
          const intact = files.every((f) => sha(f) === before.get(f)) && porcAfter === porcBefore;
          if (sw.timedOut) { rec.timed_out = true; rec.stamp_writers = { exit: sw.exit, ms: sw.ms, stale: [], timeout: true }; }
          else {
            const stale = [...sw.out.matchAll(/^\s*STALE (\S+):/gm)].map((m) => m[1]);
            rec.stamp_writers = { exit: sw.exit, ms: sw.ms, stale: [...new Set(stale)] };
          }
          if (restored) rec.stamp_writers.restored_files = restored;
          if (!intact) rec.stamp_writers.tree_intact = false;
        }
        if (rec.timed_out) rec.verdict = 'timeout';
        else {
          const kiStale = rec.kernel_identity.exit !== 0;
          const swStale = rec.stamp_writers && typeof rec.stamp_writers === 'object' && (rec.stamp_writers.exit !== 0);
          rec.verdict = kiStale || swStale ? 'stale' : 'clean';
        }
      }
    }
  } catch (e) {
    rec.verdict = 'error';
    rec.error = String(e && e.message || e).slice(0, 200);
  }
  const ms = Date.now() - t0;
  try { print(`SHADOW stale-stamp (report-only until 2026-12-01): ${rec.verdict} ${ms}ms`); } catch { /* never throws */ }
  try {
    const p = opts.logFile || logPath(repo);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, JSON.stringify(rec) + '\n');
  } catch { /* logging is best effort */ }
  return rec;
}

// ---------------------------------------------------------------- selftest
async function selfTest() {
  const fails = [];
  const ok = (c, m) => { if (c) console.log(`  ok  ${m}`); else { fails.push(m); console.log(`  FAIL ${m}`); } };
  const tmp = mkdtempSync(resolve(tmpdir(), 'sss-'));
  const repo = resolve(tmp, 'repo');
  mkdirSync(resolve(repo, 'chaingraph', 'kernels'), { recursive: true });
  mkdirSync(resolve(repo, 'manifests'), { recursive: true });
  mkdirSync(resolve(repo, 'scripts'), { recursive: true });
  writeFileSync(resolve(repo, 'chaingraph', 'art-1.html'), 'PAGE-ORIGINAL');
  spawnSync('git', ['-C', repo, 'init', '-q'], { env: gitEnv() });
  spawnSync('git', ['-C', repo, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'add', '-A'], { env: gitEnv() });
  spawnSync('git', ['-C', repo, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-qm', 'init'], { env: gitEnv() });
  const logFile = resolve(tmp, 'log.jsonl');
  const base = { repo, head: 'deadbeef', logFile, print: () => {}, capMs: 1500 };
  const exitCodeFor = async (o) => { const code = process.exitCode; await runShadow({ ...base, ...o }); const c = process.exitCode; process.exitCode = code; return c; };
  const fake = (exit, out = '', ms = 5) => async () => ({ exit, ms, timedOut: false, out });

  let r = await runShadow({ ...base, ids: ['art-1'], run: fake(1, '  STALE art-1: x\n') });
  ok(r.verdict === 'stale' && r.stamp_writers.stale[0] === 'art-1', 'stale result is logged as stale');
  ok((await exitCodeFor({ ids: ['art-1'], run: fake(1, 'STALE') })) === process.exitCode, 'stale result leaves exit code unchanged');
  r = await runShadow({ ...base, ids: ['art-1'], run: async () => { throw new Error('boom'); } });
  ok(r.verdict === 'error', 'thrown runner error is caught and logged as error');
  r = await runShadow({ ...base, ids: ['art-1'], run: (a, c, t) => new Promise((res) => setTimeout(() => res({ exit: -1, ms: t, timedOut: true, out: '' }), 10)) });
  ok(r.verdict === 'timeout' && r.timed_out === true, 'timeout is logged as timeout');
  // real child kill inside the cap
  const slow = resolve(tmp, 'slow.mjs');
  writeFileSync(slow, 'setTimeout(()=>{}, 25000);');
  const k0 = Date.now();
  const kr = await runChild([slow], tmp, 600);
  ok(kr.timedOut && Date.now() - k0 < 3000, `real child killed at the cap (${Date.now() - k0} ms)`);
  r = await runShadow({ ...base, ids: [], run: fake(0) });
  ok(r.verdict === 'skipped-no-kernel' && r.kernel_identity === null, 'no kernel touched is skipped and runs nothing');
  r = await runShadow({ ...base, ids: ['a', 'b', 'c', 'd', 'e', 'f'], run: fake(0) });
  ok(r.verdict === 'skipped-too-many', 'more than 5 ids is skipped-too-many');
  let ran = false;
  r = await runShadow({ ...base, ids: ['art-1'], now: () => new Date('2026-12-02T00:00:00Z'), run: async () => { ran = true; return { exit: 0, ms: 1, timedOut: false, out: '' }; } });
  ok(r.verdict === 'expired' && !ran, 'after expiry nothing runs');
  // tree byte-identical after a run that dirties the page and is killed
  const page = resolve(repo, 'chaingraph', 'art-1.html');
  const porc0 = spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8', env: gitEnv() }).stdout;
  let n = 0;
  r = await runShadow({ ...base, ids: ['art-1'], run: async (a) => { if (++n === 2) { writeFileSync(page, 'DIRTIED-MID-RUN'); return { exit: -1, ms: 9, timedOut: true, out: '' }; } return { exit: 0, ms: 1, timedOut: false, out: '' }; } });
  const porc1 = spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8', env: gitEnv() }).stdout;
  ok(readFileSync(page, 'utf8') === 'PAGE-ORIGINAL' && porc0 === porc1 && r.verdict === 'timeout', 'tree byte-identical after a killed run (page restored)');
  ok(readFileSync(logFile, 'utf8').trim().split('\n').every((l) => { try { JSON.parse(l); return true; } catch { return false; } }), 'every log line is valid JSON');
  ok(resolve(logPath(repo, tmp)).startsWith(resolve(repo)) === false, 'log path is outside the repo tree');
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  if (fails.length) { console.error(`stale-stamp-shadow self-test FAILED: ${fails.length}`); process.exit(1); }
  console.log('stale-stamp-shadow self-test PASSED');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) await selfTest();
