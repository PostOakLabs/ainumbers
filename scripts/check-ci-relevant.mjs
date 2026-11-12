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
 *
 * merge_group support: a queued merge_group event has NO `github.base_ref`/
 * pull_request context — `github.event.pull_request.base.sha` is empty there. It
 * carries its own `merge_group.base_sha`/`merge_group.head_sha` instead (the
 * queue's target ref and the temporary merge commit being validated), passed in
 * via MERGE_GROUP_BASE_SHA/MERGE_GROUP_HEAD_SHA. Diffed the same way as the
 * pull_request branch, with the same fail-open-on-unresolvable rule.
 */
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { isCreditsGateScopeFile } from './check-credits-coverage.mjs';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Direct-run guard (CI-RELEVANT-VENDOR-PATHS-1): the CLI flow only runs when the
// script is executed directly; when imported (by its test), only filesHit is handed over.
const DIRECT_RUN = !!process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

// CI-RELEVANT-VENDOR-PATHS-1 (2026-11-01): relevance is no narrower than the credits
// gate's OWN scan scope. Measured defect: PR #2802 added chaingraph/standard/vendor/
// canonicalize/{canonicalize.js,LICENSE,PROVENANCE.md}; no ci-paths.json glob matched,
// so both path-filtered jobs skipped the "Full preflight gate suite" that runs
// `node scripts/check-credits-coverage.mjs repo`, the PR reported green, it merged, and
// main went red on "Credits registry coverage (vendored-code license gate)". Any added
// or changed file the credits gate examines (vendor/vendored path segments,
// *.bundle.(mjs|js), data/credits-registry.json) now marks EVERY key relevant. When
// unsure, mark relevant: a false "relevant" costs CI minutes, a false "irrelevant"
// costs a red main. The predicate is imported, never copied — one source of truth.
export function filesHit(key, files) {
  const paths = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci-paths.json'), 'utf8'));
  const globs = paths[key];
  if (!globs) {
    throw new Error(`check-ci-relevant: no entry "${key}" in scripts/ci-paths.json`);
  }
  const regexes = globs.map(globToRegex);
  return files.some((f) => regexes.some((re) => re.test(f))) || files.some(isCreditsGateScopeFile);
}

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
  const ciPaths = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci-paths.json'), 'utf8'));
  if (!ciPaths[key]) {
    console.error(`✗ check-ci-relevant: no entry "${key}" in scripts/ci-paths.json`);
    process.exit(1);
  }


  const eventName = process.env.EVENT_NAME || '';
  let hit;

  function diffAgainst(base, head) {
    let resolvable = base && head;
    if (resolvable) {
      try {
        execFileSync('git', ['cat-file', '-e', base], { cwd: ROOT, env: gitEnv(), stdio: 'ignore' });
      } catch {
        resolvable = false;
      }
    }
    if (!resolvable) {
      // Undeterminable diff: fail OPEN — run the substantive job rather than silently
      // skip a check that should have gated this PR/queue entry.
      console.log(`check-ci-relevant[${key}]: base/head unresolvable — failing open (hit=true).`);
      return true;
    }
    const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base, head], {
      cwd: ROOT,
      env: gitEnv(),
      encoding: 'utf8',
    });
    const files = out.split('\n').filter(Boolean);
  const hit = filesHit(key, files);
    console.log(`check-ci-relevant[${key}]: ${files.length} file(s) changed, hit=${hit}`);
    return hit;
  }

  if (eventName === 'pull_request') {
    hit = diffAgainst(process.env.PR_BASE_SHA || '', process.env.PR_HEAD_SHA || '');
  } else if (eventName === 'merge_group') {
    // merge_group has no pull_request context; the queue supplies its own base/head shas
    // (queue target ref, temporary merge commit) via merge_group.base_sha/head_sha.
    hit = diffAgainst(process.env.MERGE_GROUP_BASE_SHA || '', process.env.MERGE_GROUP_HEAD_SHA || '');
  } else {
    // push (or local/manual run): the workflow's own `paths:` trigger filter already
    // scoped dispatch, so there is nothing further to decide here.
    hit = true;
  }

  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `hit=${hit}\n`);
  } else {
    console.log(`hit=${hit}`);
  }
}

if (DIRECT_RUN) main();
