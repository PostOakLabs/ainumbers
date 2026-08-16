#!/usr/bin/env node
/**
 * scripts/check-ci-relevant.mjs — always-report CI shape's "relevant" job helper.
 *
 * WHY: scripts-verify.yml / html-verify.yml / jsdoc-checkjs.yml / land-verify.yml are
 * path-filtered on `pull_request`, so a required status check on any of them deadlocks
 * every PR that never touches those paths (the check never dispatches, GitHub waits
 * forever). Dropping the filter entirely would run a full preflight on every docs-only
 * PR. Fix: drop the `pull_request` path filter, always dispatch the workflow, and have
 * this script decide — in a fast first job — whether the substantive job should run.
 * The reporter job downstream always runs regardless, so the check always reports.
 *
 * Path lists live in ONE place, scripts/ci-paths.json, shared by this script and by each
 * workflow's unchanged `push` trigger `paths:` block (push events are unaffected — the
 * ruleset does not gate pushes by required check, and GitHub-side path filtering already
 * scopes that trigger, so this script is not consulted for push events at all).
 *
 * Usage: node scripts/check-ci-relevant.mjs --key <scripts-verify|html-verify|jsdoc-checkjs|land-verify>
 * Writes hit=true|false to $GITHUB_OUTPUT. Not a pass/fail gate — always exits 0 (see
 * CI_ONLY allowlist entry in check-workflow-gate-parity.mjs for why preflight.mjs never
 * runs this).
 *
 * BASE/HEAD resolution and the NUL-delimited diff pattern reuse jsdoc-checkjs.yml's
 * existing, injection-safe plumbing: values cross via env:, never `${{ }}` in a run: body.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; }
      else re += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

function main() {
  const keyIdx = process.argv.indexOf('--key');
  const key = keyIdx !== -1 ? process.argv[keyIdx + 1] : null;
  if (!key) {
    console.error('usage: node scripts/check-ci-relevant.mjs --key <name>');
    process.exit(1);
  }

  const paths = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci-paths.json'), 'utf8'));
  const globs = paths[key];
  if (!globs) {
    console.error(`✗ check-ci-relevant: no entry "${key}" in scripts/ci-paths.json`);
    process.exit(1);
  }
  const regexes = globs.map(globToRegex);

  const eventName = process.env.EVENT_NAME || '';
  let hit;

  if (eventName !== 'pull_request') {
    // push (or local/manual run): the workflow's own `paths:` trigger filter already
    // scoped dispatch, so there is nothing further to decide here.
    hit = true;
  } else {
    const base = process.env.PR_BASE_SHA || '';
    const head = process.env.PR_HEAD_SHA || '';
    let resolvable = base && head;
    if (resolvable) {
      try {
        execFileSync('git', ['cat-file', '-e', base], { cwd: ROOT, stdio: 'ignore' });
      } catch {
        resolvable = false;
      }
    }
    if (!resolvable) {
      // Undeterminable diff: fail OPEN — run the substantive job rather than silently
      // skip a check that should have gated this PR.
      console.log(`check-ci-relevant[${key}]: base/head unresolvable — failing open (hit=true).`);
      hit = true;
    } else {
      const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base, head], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const files = out.split('\n').filter(Boolean);
      hit = files.some((f) => regexes.some((re) => re.test(f)));
      console.log(`check-ci-relevant[${key}]: ${files.length} file(s) changed, hit=${hit}`);
    }
  }

  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `hit=${hit}\n`);
  } else {
    console.log(`hit=${hit}`);
  }
}

main();
