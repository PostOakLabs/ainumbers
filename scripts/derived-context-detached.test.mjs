#!/usr/bin/env node
// derived-context-detached.test.mjs — RED/GREEN controls for PREPUSH-DERIVED-ADVISORY-1.
//
// isMainContext() (scripts/derived-artifacts.mjs) decides whether the main-only derived-artifact
// freshness gates (kernel index, infra registry, node footers, a11y mid-flight enrol) are HARD or
// advisory. CI pull_request is advisory; a local named feature branch is advisory; a DETACHED HEAD
// (scratch worktrees pushing HEAD:refs/heads/<branch>) used to fail closed, so a new-node PR saw
// those gates HARD locally and advisory in CI. A detached HEAD now earns the downgrade only when
// origin/main resolves and HEAD is NOT an ancestor of it.
//
// Drives the SHIPPED isMainContext()/localHeadIsMain() against real fixture git repos.
// (a) PR-branch contexts -> advisory (false).  (b) main / merge_group-with-root / push / every
// undeterminable state -> still blocking (true).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isMainContext, localHeadIsMain } from './derived-artifacts.mjs';
import { gitEnv } from './_git-env-lib.mjs';

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const sh = (cwd, ...args) => execFileSync('git', args, {
  cwd, stdio: ['ignore', 'pipe', 'pipe'],
  env: gitEnv({ GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }),
}).toString().trim();
const commit = (dir, msg) => { writeFileSync(join(dir, 'f.txt'), msg); sh(dir, 'add', 'f.txt'); sh(dir, 'commit', '-q', '-m', msg); return sh(dir, 'rev-parse', 'HEAD'); };
const withEnv = (vars, fn) => {
  const keys = Object.keys(vars); const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) { if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};

const dir = mkdtempSync(join(tmpdir(), 'derived-ctx-detached-'));
try {
  sh(dir, 'init', '-q', '-b', 'main');
  const a = commit(dir, 'a');
  const b = commit(dir, 'b');                       // origin/main = b
  sh(dir, 'update-ref', 'refs/remotes/origin/main', b);
  const local = () => localHeadIsMain({ cwd: dir });

  console.log('\nLOCAL contexts (no CI env):');
  check('main branch -> blocking (unchanged)', local() === true);
  sh(dir, 'checkout', '-q', '-b', 'feat/x'); const c = commit(dir, 'c');
  check('(a) named feature branch -> advisory (unchanged)', local() === false);
  sh(dir, 'checkout', '-q', '--detach', c);
  check('(a) RED->GREEN: detached HEAD carrying commits main lacks -> advisory', local() === false);
  sh(dir, 'checkout', '-q', '--detach', b);
  check('(b) detached HEAD == origin/main -> blocking', local() === true);
  sh(dir, 'checkout', '-q', '--detach', a);
  check('(b) detached HEAD behind origin/main -> blocking', local() === true);
  sh(dir, 'checkout', '-q', '--detach', c);
  sh(dir, 'update-ref', '-d', 'refs/remotes/origin/main');
  check('(b) detached HEAD, origin/main unresolvable -> blocking (fail closed)', local() === true);
  check('(b) not a git repo -> blocking (fail closed)', localHeadIsMain({ cwd: tmpdir() }) === true);

  console.log('\nCI contexts (env drives the oracle; fixture cwd irrelevant):');
  const ci = (event, extra = {}) => withEnv({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: event, DERIVED_ROOT: undefined, ...extra }, () => isMainContext({ cwd: dir }));
  check('(a) pull_request -> advisory', ci('pull_request') === false);
  check('(a) merge_group without DERIVED_ROOT -> advisory (legacy shape)', ci('merge_group') === false);
  check('(b) merge_group WITH DERIVED_ROOT -> blocking', ci('merge_group', { DERIVED_ROOT: '/scratch' }) === true);
  check('(b) push -> blocking', ci('push') === true);
  check('(b) workflow_dispatch -> blocking', ci('workflow_dispatch') === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n✗ derived-context-detached: ${failed} control(s) failed` : '\n✓ derived-context-detached: all RED/GREEN controls pass (PR-branch/detached-ahead advisory; main, merge_group+root, push, undeterminable blocking)');
process.exit(failed ? 1 : 0);
