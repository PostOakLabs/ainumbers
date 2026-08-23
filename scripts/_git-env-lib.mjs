#!/usr/bin/env node
/**
 * _git-env-lib.mjs — THE single place this estate builds a child environment for a `git` process.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (GIT-ENV-LEAK-SWEEP-1, 2026-08-23) — verification integrity, NOT hygiene.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Git EXPORTS `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_PREFIX` and friends into the
 * environment of every hook it runs. Node's `execSync`/`execFileSync` inherit `process.env` by
 * default. So a child `git` spawned from inside a hook INHERITS those vars — and git's repository
 * discovery lets them WIN OVER `cwd`.
 *
 * The consequence is not a crash. It is a WRONG ANSWER that still looks like an answer:
 *
 *     a gate that shells to `git ls-files` / `git show` / `git diff` to derive an "independent"
 *     verdict can be answering ABOUT THE OUTER REPOSITORY, while claiming to check a different
 *     tree. The derivation is not independent — it is independent of the thing it was meant
 *     to check. That defeats the exact property SO #34 exists to guarantee, and SO #34b
 *     ("a gate must run in the environment of the thing it validates") names it directly.
 *
 * MEASURED, three times independently, before anything made it general:
 *   · DENOMINATOR-SENTINEL-1 (2026-08-23) — its UNDETERMINABLE-FLOOR self-test PASSED standalone
 *     and went RED under the pre-push hook: a temp directory that is not a repository still
 *     answered successfully, through the leaked GIT_DIR. Pinned as that gate's RED #5b.
 *   · SHARD-HARNESS-ENV-LEAK-1 — same shape, earlier. `git init --bare` under an inherited
 *     GIT_DIR re-initialises the OUTER repo instead of the fixture.
 *   · check-clause-digest.mjs — its own header records that an un-scrubbed version of its call
 *     pattern, exercised from a test invoked by the pre-push hook, COMMITTED A THROWAWAY
 *     SANDBOX'S TREE ONTO THE REAL WORKING BRANCH.
 *
 * Each of those three fixed itself privately. By 2026-08-23 the estate carried SIX copies of this
 * logic (three denylist, three allowlist) and a dozen-plus unprotected spawn sites. This module is
 * the consolidation; `scripts/check-git-env-scrub.mjs` is the gate that keeps a seventh copy — and
 * any new unprotected site — from appearing.
 *
 * ── THE TWO SHAPES, and they are genuinely different ──────────────────────────────────────────
 *
 *   gitEnv(extra)            DENYLIST. `process.env` minus every `GIT_*` key.
 *                            For PRODUCTION gates running against the REAL repo. They still need
 *                            the ambient environment — PATH, credential helpers, proxy config,
 *                            SSL cert paths — because they may talk to a remote. All they must
 *                            NOT inherit is git's own repo-redirection state.
 *
 *   isolatedChildEnv(extra)  ALLOWLIST. Only the ~40 OS/runtime keys `git.exe` and `node.exe`
 *                            need to start at all. For FIXTURE HARNESSES that build throwaway
 *                            repositories in a temp dir. Those want isolation from the ambient
 *                            environment wholesale, not just from GIT_*, so a stray ambient var
 *                            cannot make a fixture behave differently on one machine.
 *
 * Both are ALLOWLIST-or-DENYLIST **by construction**, never "delete the four names we remember":
 * `gitEnv` drops every key matching `/^GIT_/i`, so the next variable git invents is excluded
 * without anyone editing this file. `isolatedChildEnv` admits only what is named, so the same
 * holds a fortiori. `extra` is applied LAST in both, so a caller that DELIBERATELY means to set
 * `GIT_AUTHOR_DATE` (deterministic fixture commits) still can — the ban is on INHERITING, never
 * on setting.
 *
 * ⚠ CREDENTIALS — checked, not assumed. `gitEnv` also drops `GIT_ASKPASS`, `GIT_SSH_COMMAND`,
 * `GIT_TERMINAL_PROMPT` and `GIT_CONFIG_*`. Verified 2026-08-23: no workflow under
 * `.github/workflows/` sets any `GIT_*` variable (`git grep -nE '^\s+GIT_[A-Z_]+:' --
 * .github/workflows/*` returns nothing), and `actions/checkout` injects its token through
 * `.git/config`'s `http.<url>.extraheader`, not through the environment. Local pushes here use
 * the Windows credential manager, also config-resident. If a site ever DOES need one of those
 * passed through, pass it explicitly via `extra` and say why at the call site — do not widen
 * the scrub.
 *
 * ⛔ This module changes WHICH TREE a git child talks about. It changes nothing about what any
 *    caller checks, how strict it is, or what verdict it returns.
 */

import { execFileSync, execSync } from 'node:child_process';

/**
 * Keys `git.exe` / `node.exe` need in order to start and behave normally, on both POSIX and
 * Windows. Deliberately does NOT include any `GIT_*` key. Single source for the three fixture
 * harnesses that used to carry a byte-identical private copy of this list.
 */
export const CHILD_ENV_ALLOWLIST = [
  // POSIX + Node runtime essentials
  'PATH', 'HOME', 'SHELL', 'TERM', 'TZ', 'USER', 'LOGNAME',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'XDG_CONFIG_HOME',
  // Windows runtime essentials (git.exe and node.exe both need these)
  'ALLUSERSPROFILE', 'APPDATA', 'COMPUTERNAME', 'ComSpec',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432',
  'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'LOGONSERVER',
  'NUMBER_OF_PROCESSORS', 'OS', 'PATHEXT',
  'PROCESSOR_ARCHITECTURE', 'PROCESSOR_ARCHITEW6432',
  'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'PUBLIC', 'SESSIONNAME', 'SystemDrive', 'SystemRoot',
  'TEMP', 'TMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'windir',
];

const ALLOWED = new Set(CHILD_ENV_ALLOWLIST.map((k) => k.toLowerCase()));

/** Matches every git-controlled environment variable, present and future. */
export const GIT_ENV_KEY = /^GIT_/i;

/**
 * DENYLIST env for a git child: everything the current process has, minus every `GIT_*` key,
 * plus `extra` (applied last, so a deliberate set still wins).
 *
 * After this, `cwd` is the ONLY thing that decides which repository the child operates on —
 * which is the entire point.
 *
 * @param {Record<string,string|undefined>} [extra] keys to force ON after the scrub.
 * @param {Record<string,string|undefined>} [base]  environment to scrub (default `process.env`).
 * @returns {Record<string,string>}
 */
export function gitEnv(extra = {}, base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) {
    if (!GIT_ENV_KEY.test(k) && v !== undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/**
 * ALLOWLIST env for a fixture harness child: only `CHILD_ENV_ALLOWLIST` keys, plus `extra`.
 * Excludes every `GIT_*` key by construction (none is on the allowlist) AND every other ambient
 * variable, so a throwaway repository behaves the same on every machine.
 *
 * @param {Record<string,string|undefined>} [extra] keys to force ON (e.g. GIT_AUTHOR_DATE).
 * @param {Record<string,string|undefined>} [base]  environment to filter (default `process.env`).
 * @returns {Record<string,string>}
 */
export function isolatedChildEnv(extra = {}, base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) {
    if (ALLOWED.has(k.toLowerCase()) && v !== undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/**
 * `execFileSync('git', args, …)` with a scrubbed env. Convenience only — a call site that needs
 * an unusual option shape may spawn git itself, as long as it passes `env: gitEnv(...)`, which is
 * what `check-git-env-scrub.mjs` verifies.
 */
export function gitSync(args, opts = {}) {
  const { env: extraEnv, ...rest } = opts;
  return execFileSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...rest,
    env: extraEnv ?? gitEnv(),
  });
}

/**
 * `execSync('git …', …)` with a scrubbed env, for the shell-string call shape. `cmd` must already
 * begin with `git`; this wrapper does not build it, so nothing here interpolates untrusted input
 * that the caller did not already control.
 */
export function gitShell(cmd, opts = {}) {
  const { env: extraEnv, ...rest } = opts;
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...rest,
    env: extraEnv ?? gitEnv(),
  });
}
