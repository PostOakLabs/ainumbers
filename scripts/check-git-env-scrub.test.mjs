#!/usr/bin/env node
/**
 * check-git-env-scrub.test.mjs — controls for GIT-ENV-LEAK-SWEEP-1's regression pin.
 *
 * SO #40(b): a new gate proves RED before it is trusted GREEN. A coverage gate is exactly the
 * shape that rots into a permanent green line — if its detector silently stops matching, it reports
 * "all sites scrubbed" over an estate that scrubs nothing, and nobody finds out until the fourth
 * recurrence. So the RED cases below are the load-bearing half of this file.
 *
 * LAYER 1 — RED: each control writes a fixture file that a real regression would look like, runs
 *   the gate's scanner over it, and asserts the gate SEES it. R1 is the one the row asked for by
 *   name: "a test that reds if a new git-spawning site skips the helper."
 * LAYER 2 — GREEN: the converted shapes actually in the estate are accepted, so the gate is not
 *   passing by refusing everything.
 * LAYER 3 — LIVE + CONTRAST: the gate is green on the real tree, and the scrub demonstrably
 *   changes which repository a git child answers about.
 *
 * Run: node scripts/check-git-env-scrub.test.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitEnv, isolatedChildEnv } from './_git-env-lib.mjs';
import { deriveSandboxFiles, REPO_ROOT } from './lib-sandbox-deps.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = resolve(REPO, 'scripts', 'check-git-env-scrub.mjs');

// ── _git-env-lib.mjs IS DERIVED-AND-COPIED-VERBATIM, NOT REPRODUCED (SANDBOX-FILELIST-SWEEP-2) ──
// This used to write a HAND-WRITTEN reimplementation of _git-env-lib.mjs's gitEnv()/
// isolatedChildEnv() into the fixture — never fresh, a private copy of the file this very gate
// exists to complain about other files having. Replaced with deriveSandboxFiles()'s
// derive-then-copy-verbatim shape (scripts/check-shard-assembly.test.mjs, SANDBOX-FILELIST-GATE-1):
// the real file, copied byte-identical from the working tree.
//
// check-git-env-scrub.mjs itself STAYS on the `git show HEAD:...` copy below, NOT run through
// deriveSandboxFiles as a root — measured, not a style choice: this gate's own PATTERN_DEFINERS/
// FIXTURE_BEARING sets carry the literal string 'scripts/check-git-env-scrub.test.mjs' as DATA
// (files exempted from its OWN coverage scan), and deriveSandboxFiles's shell-out heuristic (any
// module-extension string literal that resolves to a real repo file) reads that literal as a spawn
// target, pulls THIS test file into its own derivation, and false-trips the createRequire guard on
// lib-sandbox-deps.mjs's own source (which necessarily contains the word "createRequire" as its own
// detection pattern). check-git-env-scrub.mjs is not in this row's fence to fix, so the gate file
// keeps its existing fresh-via-git-show copy; only _git-env-lib.mjs — whose closure is provably
// just itself (zero imports, zero module-extension literals) — goes through derivation.
const SANDBOX_ROOTS = ['scripts/_git-env-lib.mjs'];
const SANDBOX_FILES = deriveSandboxFiles({ roots: SANDBOX_ROOTS });

let passed = 0;
let failed = 0;
const cleanup = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

process.on('exit', () => {
  for (const d of cleanup) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

/**
 * Run the REAL gate against a throwaway repository containing exactly `files`.
 *
 * SO #34: the control must exercise the gate's own scanner, never a re-implementation of it here —
 * a checker verified by a second copy of itself proves only that the two copies agree. The gate
 * enumerates with `git ls-files`, so the fixture is a real repo with a real index.
 *
 * Child env is isolatedChildEnv(): this file is wired into preflight.mjs, which the pre-push hook
 * invokes, and a fixture repo built under an inherited GIT_DIR initialises the OUTER repository
 * instead. That is SHARD-HARNESS-ENV-LEAK-1's measured failure, and dogfooding the helper here is
 * the point of the exercise.
 */
function runGateOver(files, { pad = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ges-'));
  cleanup.push(dir);
  // The gate refuses to return a verdict on a scan that found almost nothing (its SO #34c
  // denominator floor). A two-file fixture trips that floor, so every case except the two that are
  // ABOUT the floor ships 25 correctly-scrubbed sites as ballast. Padding with CLEAN sites is
  // deliberate: it must not be able to mask a violation in the file under test.
  if (pad) {
    files = {
      ...files,
      'scripts/pad-sites.mjs':
        "import { execFileSync } from 'node:child_process';\n" +
        "import { gitEnv } from './_git-env-lib.mjs';\n" +
        Array.from({ length: 25 }, (_, i) =>
          `export const pad${i} = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), env: gitEnv() });`
        ).join('\n') + '\n',
    };
  }
  const git = (args) => execFileSync('git', args, { cwd: dir, env: isolatedChildEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  // The gate resolves its own module directory as the repo root, so it must live in the fixture.
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body, 'utf8');
  }
  // DERIVED-AND-COPIED-VERBATIM, not reproduced — see SANDBOX_FILES above.
  for (const rel of SANDBOX_FILES) {
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(resolve(REPO_ROOT, rel), dest);
  }
  writeFileSync(join(dir, 'scripts', 'check-git-env-scrub.mjs'),
    execFileSync('git', ['show', 'HEAD:scripts/check-git-env-scrub.mjs'], { cwd: REPO, env: gitEnv(), encoding: 'utf8' }), 'utf8');
  git(['add', '-A']);
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(process.execPath, [join(dir, 'scripts', 'check-git-env-scrub.mjs')],
      { cwd: dir, env: isolatedChildEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    code = e.status ?? 1;
    stdout = (e.stdout || '') + (e.stderr || '');
  }
  return { code, stdout };
}

console.log('check-git-env-scrub controls — LAYER 1 (RED: the gate must SEE each regression)');

// ── R1 — THE ROW'S NAMED REQUIREMENT ────────────────────────────────────────────────────────────
// A brand-new gate spawns git and forgets the helper. This is the exact shape that recurred three
// times; if this control ever goes green-without-red, the sweep has silently unpinned itself.
test('R1 a NEW git-spawning site with no scrub is caught', () => {
  const r = runGateOver({
    'scripts/brand-new-gate.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      "const out = execFileSync('git', ['ls-files'], { cwd: process.cwd(), encoding: 'utf8' });\n" +
      'console.log(out.length);\n',
  });
  assert(r.code !== 0, `expected a RED exit, got ${r.code}\n${r.stdout}`);
  assert(/brand-new-gate\.mjs/.test(r.stdout), `the offending file must be NAMED, not just counted:\n${r.stdout}`);
});

// ── R2 — the shell-string call shape, which is half the estate ──────────────────────────────────
test('R2 the execSync("git …") shell-string shape is caught too', () => {
  const r = runGateOver({
    'scripts/shell-shape.mjs':
      "import { execSync } from 'node:child_process';\n" +
      "console.log(execSync('git status --porcelain', { cwd: process.cwd() }).toString());\n",
  });
  assert(r.code !== 0, `expected a RED exit, got ${r.code}\n${r.stdout}`);
  assert(/shell-shape\.mjs/.test(r.stdout), `must name the file:\n${r.stdout}`);
});

// ── R3 — a SEVENTH private copy of the scrub ────────────────────────────────────────────────────
// Six copies is how this class survived three separate fixes. A private re-implementation passes
// the coverage check by construction, so "covered" alone would be a false green.
test('R3 a private re-implementation of the scrub is caught', () => {
  const r = runGateOver({
    'scripts/private-copy.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      'function myOwnGitEnv() {\n' +
      '  const e = { ...process.env };\n' +
      "  for (const k of Object.keys(e)) if (/^GIT_/i.test(k)) delete e[k];\n" +
      '  return e;\n' +
      '}\n' +
      "execFileSync('git', ['status'], { cwd: process.cwd(), env: myOwnGitEnv() });\n",
  });
  assert(r.code !== 0, `expected a RED exit, got ${r.code}\n${r.stdout}`);
  assert(/private-copy\.mjs/.test(r.stdout) && /exist once|re-implementation/i.test(r.stdout),
    `must be reported as a duplicate copy, not merely as uncovered:\n${r.stdout}`);
});

// ── R4 — a LOOK-ALIKE that satisfies coverage while scrubbing nothing ───────────────────────────
// The nastiest failure mode: a local `gitEnv` that is not the shared one. Without the provenance
// check the coverage scan would happily call this site protected.
test('R4 a local gitEnv() look-alike that is never imported is caught', () => {
  const r = runGateOver({
    'scripts/look-alike.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      'const gitEnv = () => process.env; // scrubs NOTHING\n' +
      "execFileSync('git', ['status'], { cwd: process.cwd(), env: gitEnv() });\n",
  });
  assert(r.code !== 0, `expected a RED exit, got ${r.code}\n${r.stdout}`);
  assert(/look-alike\.mjs/.test(r.stdout), `must name the file:\n${r.stdout}`);
});

// ── R5 — an exemption with no real reason ───────────────────────────────────────────────────────
// The escape hatch must not be usable as a silent one. A bare marker is still a violation.
test('R5 an exemption marker with a token reason does not excuse a site', () => {
  const r = runGateOver({
    'scripts/lazy-exempt.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      '// GIT-ENV-EXEMPT: reasons\n' +
      "execFileSync('git', ['status'], { cwd: process.cwd() });\n",
  });
  assert(r.code !== 0, `expected a RED exit, got ${r.code}\n${r.stdout}`);
  assert(/under 24 chars/.test(r.stdout), `must say WHY the exemption was rejected:\n${r.stdout}`);
});

// ── R6 — DENOMINATOR: a detector that matches nothing is not a pass (SO #34c) ───────────────────
test('R6 a scan that finds no spawn sites reports UNDETERMINABLE, never green', () => {
  const r = runGateOver({ 'scripts/inert.mjs': 'export const nothing = 1;\n' }, { pad: false });
  assert(r.code !== 0, `an empty scan must not exit 0, got ${r.code}\n${r.stdout}`);
  assert(/UNDETERMINABLE/.test(r.stdout), `must name the state, not print a green line:\n${r.stdout}`);
});

console.log('\nLAYER 2 (GREEN: the converted shapes in the estate are accepted)');

test('G1 a direct env: gitEnv() call site passes', () => {
  const r = runGateOver({
    'scripts/direct.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      "import { gitEnv } from './_git-env-lib.mjs';\n" +
      "execFileSync('git', ['status'], { cwd: process.cwd(), env: gitEnv() });\n",
  });
  assert(r.code === 0, `expected GREEN, got ${r.code}\n${r.stdout}`);
});

test('G2 an indirect options constant that reaches gitEnv() passes', () => {
  // check-derived-regen-live.mjs's real shape: `{ cwd, ...GIT_EXEC_OPTS }`.
  const r = runGateOver({
    'scripts/indirect.mjs':
      "import { execSync } from 'node:child_process';\n" +
      "import { gitEnv } from './_git-env-lib.mjs';\n" +
      "const GIT_EXEC_OPTS = { stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() };\n" +
      "execSync('git status --porcelain', { cwd: process.cwd(), ...GIT_EXEC_OPTS });\n",
  });
  assert(r.code === 0, `expected GREEN, got ${r.code}\n${r.stdout}`);
});

test('G3 a site DOCUMENTED in a comment is not mistaken for a real spawn', () => {
  // The gate and _git-env-lib.mjs both describe the call shapes they hunt for. A detector that
  // reads its own prose as code indicts every file that explains the rule.
  const r = runGateOver({
    'scripts/documented.mjs':
      '/**\n * Prefer execFileSync(\'git\', args, …) with a scrubbed env; never execSync(\'git …\').\n */\n' +
      'export const note = 1;\n' +
      "// A commented-out call: execFileSync('git', ['status'], {})\n",
  }, { pad: false });
  assert(/UNDETERMINABLE/.test(r.stdout),
    `comments must contribute ZERO spawn sites — this fixture has no real ones, so the ` +
    `denominator floor is what should fire:\n${r.stdout}`);
  assert(!/documented\.mjs/.test(r.stdout.split('UNDETERMINABLE')[0] || ''),
    `must not report the commented shapes as violations:\n${r.stdout}`);
});

test('G4 a deliberate exemption with a real written reason is accepted and PRINTED', () => {
  const r = runGateOver({
    'scripts/exempted.mjs':
      "import { execFileSync } from 'node:child_process';\n" +
      "import { gitEnv } from './_git-env-lib.mjs';\n" +
      "execFileSync('git', ['status'], { cwd: process.cwd(), env: gitEnv() });\n" +
      '// GIT-ENV-EXEMPT: this call deliberately reads the ambient hook repository, which is the\n' +
      '// subject under test rather than an accident of inheritance.\n' +
      "execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() });\n",
  });
  assert(r.code === 0, `expected GREEN, got ${r.code}\n${r.stdout}`);
  assert(/EXEMPT:/.test(r.stdout), `an exemption must be VISIBLE on every run, never silent:\n${r.stdout}`);
});

console.log('\nLAYER 3 (LIVE: real tree + the wrong-tree contrast this row exists to close)');

test('L1 the gate is green on the real repository', () => {
  const out = execFileSync(process.execPath, [GATE], { cwd: REPO, env: gitEnv(), encoding: 'utf8' });
  assert(/all \d+ git spawn site\(s\) scrub GIT_\*/.test(out), `expected a green summary:\n${out}`);
});

test('L2 gitEnv() removes every GIT_* key and keeps everything else', () => {
  const base = { PATH: '/usr/bin', GIT_DIR: '/other/.git', GIT_WORK_TREE: '/other', git_index_file: '/x', HOME: '/h' };
  const e = gitEnv({}, base);
  assert(!('GIT_DIR' in e) && !('GIT_WORK_TREE' in e), 'GIT_DIR/GIT_WORK_TREE must be dropped');
  assert(!('git_index_file' in e), 'the match must be case-insensitive — git accepts either casing');
  assert(e.PATH === '/usr/bin' && e.HOME === '/h', 'non-git keys must survive: gates still need PATH');
});

test('L3 `extra` still wins, so a deliberate GIT_* set is not collateral damage', () => {
  // check-nav-reachability.test.mjs and check-shard-assembly.test.mjs both set GIT_AUTHOR_DATE on
  // purpose, for reproducible fixture commits. The ban is on INHERITING, never on setting.
  const e = gitEnv({ GIT_AUTHOR_DATE: '2026-08-23T00:00:00Z' }, { GIT_DIR: '/other/.git' });
  assert(e.GIT_AUTHOR_DATE === '2026-08-23T00:00:00Z', 'an explicit extra must survive the scrub');
  assert(!('GIT_DIR' in e), 'an INHERITED key must still be dropped');
});

// ── L4 — THE CONTRAST. Without this the sweep proves nothing. ───────────────────────────────────
test('L4 an inherited GIT_DIR answers about the OTHER tree, and gitEnv() stops it', () => {
  // Build a decoy repository with a file the real repo does not have, then ask git — from a cwd
  // inside the REAL repo — for that decoy file. Un-scrubbed, the leaked GIT_DIR wins and the decoy
  // file is found; scrubbed, `cwd` decides and it is not.
  const decoy = mkdtempSync(join(tmpdir(), 'ges-decoy-'));
  cleanup.push(decoy);
  const dg = (args) => execFileSync('git', args, { cwd: decoy, env: isolatedChildEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  dg(['init', '-q']);
  writeFileSync(join(decoy, 'ONLY-IN-THE-DECOY.txt'), 'x', 'utf8');
  dg(['add', '-A']);

  const leaked = { ...process.env, GIT_DIR: join(decoy, '.git'), GIT_WORK_TREE: decoy };
  const ask = (env) => execFileSync('git', ['ls-files', '--', 'ONLY-IN-THE-DECOY.txt'],
    { cwd: REPO, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  const withLeak = ask(leaked);
  const withScrub = ask(gitEnv({}, leaked));

  assert(withLeak === 'ONLY-IN-THE-DECOY.txt',
    'BEFORE: an inherited GIT_DIR must demonstrably answer about the decoy repo — if this does not ' +
    `reproduce, the control is not testing anything (got ${JSON.stringify(withLeak)})`);
  assert(withScrub === '',
    'AFTER: with GIT_* scrubbed, the same command run from the same cwd must answer about the REAL ' +
    `repo, which has no such file (got ${JSON.stringify(withScrub)})`);
});

console.log(`\ncheck-git-env-scrub controls: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
