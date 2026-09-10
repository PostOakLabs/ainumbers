#!/usr/bin/env node
// scripts/diff-scope.test.mjs — mutation-provable fixture proof for TOUCHTAX-DIFFSCOPE-1's shared
// diff-scoping helper (SO #34: "verify a checker by mutation, not by reading it").
//
// Proves, against real throwaway git sandboxes (same isolatedChildEnv() pattern
// check-clause-digest.test.mjs already uses — never a private env scrub, GIT-ENV-LEAK-SWEEP-1):
//   1. An untouched file vs baseRef: changedLineSet returns ok:true, isNew:false, lines empty —
//      every line is pre-existing/shielded.
//   2. A file with exactly one line CHANGED: only that line number is unshielded; every other line
//      (the PAYROLL kill-proof shape) stays shielded, even though the FILE differs from baseRef.
//   3. A brand-new file (absent at baseRef): isNew:true — nothing shielded, full scope, by design.
//   4. Undeterminable base ref (no remote at all): resolveDiffScopeRef returns null, and
//      changedLineSet/isPreExisting both FAIL CLOSED (ok:false, isPreExisting always false) —
//      never silently exempt on doubt (SO #34c / J19 §3.3).
//   5. --diff-scope <REF> on argv overrides the default candidate chain.
//   6. isPreExisting is a pure fail-closed predicate: ok:false or isNew:true both yield false,
//      regardless of the line-set contents — a mutation control, not just a happy-path read.
//
// Zero-dependency. Non-zero exit blocks.  node scripts/diff-scope.test.mjs

import { resolveDiffScopeRef, changedLineSet, isPreExisting, lineOfText } from './diff-scope.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isolatedChildEnv } from './_git-env-lib.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: isolatedChildEnv() });
}

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

log('— lineOfText: pure substring→1-indexed-line mapping —');
{
  const text = 'line1\nline2\nneedle-here\nline4';
  ok(lineOfText(text, 'needle-here') === 3, 'needle on line 3 is found at line 3');
  ok(lineOfText(text, 'line1') === 1, 'needle on line 1 is found at line 1');
  ok(lineOfText(text, 'absent') === -1, 'absent needle returns -1');
  ok(lineOfText(text, '') === -1, 'empty needle returns -1 (never matches everything)');
}

log('— isPreExisting: fail-closed by construction (mutation control, not a happy-path read) —');
{
  const shieldedScope = { ok: true, isNew: false, lines: new Set([5]) };
  ok(isPreExisting(shieldedScope, 1) === true, 'line 1 not in changed set -> shielded');
  ok(isPreExisting(shieldedScope, 5) === false, 'line 5 IS in changed set -> not shielded');
  ok(isPreExisting({ ok: false, isNew: false, lines: new Set() }, 1) === false, 'ok:false (undeterminable) -> NEVER shielded, any line');
  ok(isPreExisting({ ok: true, isNew: true, lines: new Set() }, 1) === false, 'isNew:true (brand-new file) -> NEVER shielded, any line');
  ok(isPreExisting(null, 1) === false, 'null scope -> fails closed, not a throw');
}

const root = mkdtempSync(join(tmpdir(), 'dscope-'));
try {
  const originDir = join(root, 'origin.git');
  const workDir = join(root, 'work');

  git(root, ['init', '--bare', '-q', '-b', 'main', originDir]);
  git(root, ['clone', '-q', originDir, workDir]);
  git(workDir, ['config', 'user.email', 't@t.test']);
  git(workDir, ['config', 'user.name', 't']);

  // Base commit: a 5-line file, one node-shaped citation-style file for realism.
  const target = join(workDir, 'target.txt');
  writeFileSync(target, 'alpha\nbeta\ngamma\ndelta\nepsilon\n');
  git(workDir, ['add', '-A']);
  git(workDir, ['commit', '-q', '-m', 'base']);
  git(workDir, ['push', '-q', 'origin', 'HEAD:main']);
  git(workDir, ['fetch', '-q', 'origin']);

  log('— resolveDiffScopeRef: origin/main resolves as the default candidate —');
  {
    const ref = resolveDiffScopeRef(workDir, {});
    ok(ref === 'origin/main', `resolves to origin/main (got ${ref})`);
  }

  log('— resolveDiffScopeRef: --diff-scope <REF> on argv wins over the default chain —');
  {
    const headSha = git(workDir, ['rev-parse', 'HEAD']).trim();
    const ref = resolveDiffScopeRef(workDir, { argv: ['node', 'x.mjs', '--diff-scope', headSha] });
    ok(ref === headSha, `--diff-scope override honored (got ${ref})`);
  }

  log('— changedLineSet: untouched file vs origin/main — every line shielded, nothing new —');
  {
    const scope = changedLineSet(workDir, 'target.txt', 'origin/main');
    ok(scope.ok === true, 'ok:true');
    ok(scope.isNew === false, 'isNew:false — file exists at baseRef');
    ok(scope.lines.size === 0, 'zero changed lines — file identical to origin/main');
    ok(isPreExisting(scope, 1) && isPreExisting(scope, 5), 'every line 1..5 shielded (byte-identical)');
  }

  log('— changedLineSet: ONE line changed — only that line unshielded (the PAYROLL kill-proof) —');
  {
    // Change ONLY line 3 ("gamma" -> "GAMMA-EDITED"); lines 1,2,4,5 stay byte-identical.
    writeFileSync(target, 'alpha\nbeta\nGAMMA-EDITED\ndelta\nepsilon\n');
    const scope = changedLineSet(workDir, 'target.txt', 'origin/main');
    ok(scope.ok === true, 'ok:true');
    ok(scope.isNew === false, 'isNew:false');
    ok(scope.lines.has(3), 'line 3 (the actual edit) IS in the changed set');
    ok(!scope.lines.has(1) && !scope.lines.has(2) && !scope.lines.has(4) && !scope.lines.has(5),
      'lines 1,2,4,5 are NOT in the changed set — untouched despite the file as a whole differing from origin/main');
    ok(isPreExisting(scope, 1) === true, 'line 1 reads as pre-existing/shielded');
    ok(isPreExisting(scope, 3) === false, 'line 3 (the new edit) reads as NOT shielded — still caught');
    // restore for subsequent sections
    git(workDir, ['checkout', '--', 'target.txt']);
  }

  log('— changedLineSet: brand-new file, absent at baseRef — isNew:true, nothing shielded —');
  {
    const brandNew = join(workDir, 'brand-new.txt');
    writeFileSync(brandNew, 'only-line\n');
    const scope = changedLineSet(workDir, 'brand-new.txt', 'origin/main');
    ok(scope.ok === true, 'ok:true');
    ok(scope.isNew === true, 'isNew:true — absent from origin/main');
    ok(isPreExisting(scope, 1) === false, 'line 1 of a brand-new file is NEVER shielded');
    rmSync(brandNew);
  }

  log('— changedLineSet: undeterminable base ref (null) — fails CLOSED, never throws —');
  {
    let threw = false;
    let scope;
    try { scope = changedLineSet(workDir, 'target.txt', null); } catch { threw = true; }
    ok(!threw, 'does not throw on a null baseRef');
    ok(scope.ok === false, 'ok:false — the undeterminable state, distinct from a clean pass');
    ok(isPreExisting(scope, 1) === false, 'nothing reads as shielded when the comparison is undeterminable');
  }

  log('— resolveDiffScopeRef: no remote at all — undeterminable, returns null, no throw —');
  {
    const lonely = mkdtempSync(join(tmpdir(), 'dscope-lonely-'));
    try {
      git(lonely, ['init', '-q']);
      git(lonely, ['config', 'user.email', 't@t.test']);
      git(lonely, ['config', 'user.name', 't']);
      writeFileSync(join(lonely, 'f.txt'), 'x\n');
      git(lonely, ['add', '-A']);
      git(lonely, ['commit', '-q', '-m', 'solo']);
      let threw = false;
      let ref;
      try { ref = resolveDiffScopeRef(lonely, {}); } catch { threw = true; }
      ok(!threw, 'does not throw with no origin remote and no upstream');
      ok(ref === null, `returns null (undeterminable), got ${ref}`);
    } finally {
      rmSync(lonely, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);
