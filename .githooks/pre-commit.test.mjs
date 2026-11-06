#!/usr/bin/env node
/**
 * .githooks/pre-commit.test.mjs: fixture proof for the pre-commit hygiene hook.
 *
 * The hook pipes the staged path list into scripts/precommit-hygiene.mjs, which runs the
 * hygiene gate set (AFFECTED_HYGIENE_CMDS, shared with `preflight.mjs --hygiene`) scoped to the
 * staged paths. Real gates are replaced by mocks that log their argv and staged-scope env, so
 * this proves the hook's selection, scoping, blocking and messaging, never the gates themselves.
 *
 * Proves:
 *   1. A commit that stages only docs-like paths (no relevant extension) runs no gate.
 *   2. Staging an .html page selects exactly the gates relevant to it, scoped gates get
 *      `--changed HEAD`, whole-repo gates get no args, and each child sees the staged list.
 *   3. RED CONTROL: a red gate blocks the commit (exit 1) and the output names the gate and the fix.
 *   4. GREEN CONTROL: all mocks green, exit 0.
 *   5. The hook works from a subdirectory (linked-worktree shape: it cd's to the top level).
 *   6. A gate in the shared hygiene set with no RELEVANT entry would run unconditionally (fail safe).
 *   7. _changed-files-lib returns exactly the staged set when AINUM_CHANGED_STAGED_FILES is set.
 *
 * Usage: node .githooks/pre-commit.test.mjs   (exit 0 = all assertions passed)
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isolatedChildEnv } from '../scripts/_git-env-lib.mjs';
import { AFFECTED_HYGIENE_CMDS } from '../scripts/lib/affected-gates.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_SRC = join(REPO, '.githooks', 'pre-commit');
const SCRATCH_ROOT = join(REPO, '.tmp');

function resolveBash() {
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) {
      if (!root) continue;
      const p = join(root, 'Git', 'usr', 'bin', 'bash.exe');
      if (existsSync(p)) return p;
    }
  }
  return 'bash';
}
const BASH = resolveBash();
function cleanup(dir) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort */ } }

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`✓ ${msg}`);
  else { failures++; console.log(`✗ ${msg}`); }
}

const MOCK_GATE = `import { appendFileSync } from 'node:fs';
const name = process.argv[1].split(/[\\\\/]/).pop();
appendFileSync(process.env.MOCK_LOG, JSON.stringify({ name, args: process.argv.slice(2), staged: process.env.AINUM_CHANGED_STAGED_FILES }) + '\\n');
const red = (process.env.MOCK_RED || '').split(',');
if (red.includes(name)) { console.log('mock finding from ' + name); process.exit(1); }
`;

function git(dir, args) {
  return spawnSync('git', args, { cwd: dir, env: isolatedChildEnv(), encoding: 'utf8' });
}

function makeSandbox(stage) {
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  const dir = mkdtempSync(join(SCRATCH_ROOT, 'ain-pc-'));
  mkdirSync(join(dir, '.githooks'), { recursive: true });
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true });
  copyFileSync(HOOK_SRC, join(dir, '.githooks', 'pre-commit'));
  chmodSync(join(dir, '.githooks', 'pre-commit'), 0o755);
  for (const f of ['precommit-hygiene.mjs', '_git-env-lib.mjs', 'lib/affected-gates.mjs']) {
    copyFileSync(join(REPO, 'scripts', f), join(dir, 'scripts', f));
  }
  for (const cmd of AFFECTED_HYGIENE_CMDS) {
    writeFileSync(join(dir, cmd.split(' ')[1]), MOCK_GATE);
  }
  git(dir, ['init', '-q']);
  for (const f of stage) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), 'x\n');
    git(dir, ['add', f]);
  }
  return dir;
}

function runHook(dir, { cwd = dir, env = {} } = {}) {
  const log = join(dir, 'gate-log.jsonl');
  const res = spawnSync(BASH, [join(dir, '.githooks', 'pre-commit')], {
    cwd,
    // Hooks run with GIT_INDEX_FILE etc. exported; spawn without them here so the repo is found by cwd.
    env: { ...isolatedChildEnv(), MOCK_LOG: log, ...env },
    encoding: 'utf8',
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { status: res.status, out: (res.stdout || '') + (res.stderr || ''), calls };
}

// 1. Nothing relevant staged: no gate runs.
{
  const dir = makeSandbox(['notes.txt']);
  const r = runHook(dir);
  assert(r.status === 0 && r.calls.length === 0, `non-relevant staged path runs no gate (status ${r.status}, ${r.calls.length} calls)`);
  cleanup(dir);
}

// 2 + 4. An .html page selects the page gates, scoped correctly; green exits 0.
{
  const dir = makeSandbox(['tools/9999-demo.html']);
  const r = runHook(dir);
  const names = r.calls.map((c) => c.name).sort();
  assert(r.status === 0, `GREEN: all mock gates green, hook exits 0 (status ${r.status})`);
  assert(JSON.stringify(names) === JSON.stringify(['check-copy-hallmarks.mjs', 'check-pii-banner.mjs', 'check-tool-number-unique.mjs', 'check_tools.js']),
    `staged tools/*.html selects copy-hallmarks, PII banner, tool-number, JS syntax only (got ${names.join(', ')})`);
  const byName = Object.fromEntries(r.calls.map((c) => [c.name, c]));
  assert(JSON.stringify(byName['check-copy-hallmarks.mjs'].args) === JSON.stringify(['--changed', 'HEAD']), 'scoped gate runs with --changed HEAD');
  assert(byName['check-pii-banner.mjs'].args.length === 0, 'whole-repo gate runs with no extra args');
  assert(r.calls.every((c) => c.staged === 'tools/9999-demo.html'), 'every child receives exactly the staged list');
  cleanup(dir);
}

// 3. RED CONTROL: block, name the gate, print the fix.
{
  const dir = makeSandbox(['guides/x.html']);
  const r = runHook(dir, { env: { MOCK_RED: 'check-copy-hallmarks.mjs' } });
  assert(r.status === 1, `RED: a red gate blocks the commit (status ${r.status})`);
  assert(/RED gate "copy hallmarks"/.test(r.out) && /Fix: /.test(r.out) && /mock finding from check-copy-hallmarks/.test(r.out) && /--no-verify/.test(r.out),
    'RED: output names the gate, shows its finding, prints the fix and the standard bypass');
  cleanup(dir);
}

// 5. Works from a subdirectory.
{
  const dir = makeSandbox(['scripts/foo.mjs']);
  mkdirSync(join(dir, 'scripts', 'sub'), { recursive: true });
  const r = runHook(dir, { cwd: join(dir, 'scripts', 'sub') });
  assert(r.status === 0 && r.calls.map((c) => c.name).join() === 'check-git-env-scrub.mjs', `hook resolves the top level from a subdirectory (got ${r.calls.map((c) => c.name).join()})`);
  cleanup(dir);
}

// 6. An unmapped gate in the shared set runs on every commit (fail safe).
{
  const dir = makeSandbox(['notes.txt']);
  const f = join(dir, 'scripts', 'lib', 'affected-gates.mjs');
  writeFileSync(f, readFileSync(f, 'utf8').replace("'node scripts/check-pii-banner.mjs',", "'node scripts/check-pii-banner.mjs',\n  'node scripts/check-new-gate.mjs',"));
  writeFileSync(join(dir, 'scripts', 'check-new-gate.mjs'), MOCK_GATE);
  const r = runHook(dir);
  assert(r.calls.map((c) => c.name).join() === 'check-new-gate.mjs', `a hygiene-set gate with no relevance entry still runs (got ${r.calls.map((c) => c.name).join()})`);
  cleanup(dir);
}

// 7. The shared lib honours the staged-scope env.
{
  const res = spawnSync(process.execPath, ['-e', "const l=require('./scripts/_changed-files-lib.js');console.log(JSON.stringify([...l.getChangedFiles('HEAD')]))"], {
    cwd: REPO, env: { ...isolatedChildEnv(), AINUM_CHANGED_STAGED_FILES: 'a/b.html\nc.json' }, encoding: 'utf8',
  });
  assert(res.stdout.trim() === '["a/b.html","c.json"]', `_changed-files-lib returns exactly the staged set under AINUM_CHANGED_STAGED_FILES (got ${res.stdout.trim()})`);
}

console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
