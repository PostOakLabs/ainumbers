#!/usr/bin/env node
// scripts/precommit-hygiene.mjs: the cheap hygiene gates, run on the STAGED diff, so a bad
// commit never forms. Called by .githooks/pre-commit, which pipes the staged path list in on
// stdin (`git diff --cached --name-only --diff-filter=ACMR`). Reads the list from stdin rather
// than asking git here, because git exports GIT_INDEX_FILE into a hook (a `git commit -a` or
// `git commit <path>` uses a temporary index) and this repo's child spawns scrub every GIT_*
// variable (scripts/_git-env-lib.mjs), which would make a scrubbed `git diff --cached` read the
// wrong index.
//
// The gate list is NOT defined here. It is AFFECTED_HYGIENE_CMDS from
// scripts/lib/affected-gates.mjs, the same set `node scripts/preflight.mjs --hygiene` runs on
// push. This file only adds two things per command: which staged paths make it relevant (so a
// docs-only commit skips the JS gates), and the fix text printed when it fails. A command with no
// entry in RELEVANT runs on every commit (fail safe), so a gate added to the hygiene set is
// never silently dropped here.
//
// Scoping: gates that support `--changed <ref>` run with `--changed HEAD` plus
// AINUM_CHANGED_STAGED_FILES, which makes scripts/_changed-files-lib.js return exactly the staged
// set instead of the union with unstaged and untracked files. The two whole-repo static scans
// (git-env scrub, PII banner) run unscoped, but only when a relevant file is staged.
// Gates read the working-tree bytes of each staged file, which equals the staged bytes unless a
// file is partially staged.
//
// Bypass: the standard `git commit --no-verify`. Nothing here blocks it.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';
import { AFFECTED_HYGIENE_CMDS } from './lib/affected-gates.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// cmd -> { re: staged path test, scoped: supports --changed, name, fix }
export const RELEVANT = {
  'node scripts/check-git-env-scrub.mjs': {
    name: 'git-env scrub', scoped: false,
    re: /\.(?:m?js|cjs)$/,
    fix: 'Wrap the flagged git spawn in `env: gitEnv()` (import from scripts/_git-env-lib.mjs), or use gitSync().',
  },
  'node scripts/check-internal-lang-leak.mjs': {
    name: 'internal-lang leak', scoped: true,
    re: /\.(?:ya?ml|md)$/,
    fix: 'Reword the flagged comment or doc line so it names the behavior, not an internal row id, standing order, or strategy term.',
  },
  'node scripts/check-copy-hallmarks.mjs': {
    name: 'copy hallmarks', scoped: true,
    re: /\.(?:html|json)$/,
    fix: 'Rewrite the flagged visible copy: no em-dashes (use a comma, colon, or en-dash range) and no build codes such as "Wave N".',
  },
  'node scripts/check_tools.js': {
    name: 'JS syntax', scoped: true,
    re: /\.(?:html|js)$/,
    fix: 'Fix the syntax error in the flagged page (`node scripts/locate_errors.js` pinpoints the break).',
  },
  'node scripts/check-pii-banner.mjs': {
    name: 'PII banner', scoped: false,
    re: /\.html$/,
    fix: 'Add the exact CONTRACT section 1.3 PII banner sentence to the rendered text of the flagged page.',
  },
  'node scripts/check-tool-number-unique.mjs': {
    name: 'tool-number uniqueness', scoped: true,
    re: /^tools\//,
    fix: 'Renumber the new tool so its number is unique among tools/.',
  },
};

function run(cmd, scoped, stagedList) {
  const argv = cmd.split(' ').slice(1);
  if (scoped) argv.push('--changed', 'HEAD');
  return new Promise((done) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, argv, {
      cwd: REPO,
      env: gitEnv({ AINUM_CHANGED_STAGED_FILES: stagedList.join('\n') }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => done({ cmd, code, out, ms: Date.now() - t0 }));
  });
}

const staged = readFileSync(0, 'utf8').split('\n').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean);
if (staged.length === 0) process.exit(0);

const plan = AFFECTED_HYGIENE_CMDS
  .map((cmd) => ({ cmd, meta: RELEVANT[cmd] }))
  .filter(({ meta }) => !meta || staged.some((f) => meta.re.test(f)));

const t0 = Date.now();
const results = await Promise.all(plan.map(({ cmd, meta }) => run(cmd, meta ? meta.scoped : false, staged)));
const red = results.filter((r) => r.code !== 0);

if (red.length === 0) {
  console.log(`pre-commit: ${results.length} hygiene gate(s) green on ${staged.length} staged file(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  process.exit(0);
}
for (const r of red) {
  const meta = RELEVANT[r.cmd];
  console.error(`\npre-commit: RED gate "${meta ? meta.name : r.cmd}" (${r.cmd})`);
  console.error(r.out.trim().split('\n').slice(-25).join('\n'));
  console.error(`  Fix: ${meta ? meta.fix : 'see the gate output above.'}`);
}
console.error(`\npre-commit: ${red.length} hygiene gate(s) red; commit blocked. Fix and re-stage. (Standard bypass: git commit --no-verify.)`);
process.exit(1);
