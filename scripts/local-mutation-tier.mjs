#!/usr/bin/env node
// local-mutation-tier.mjs (MUTATION-TIER-BUILDER-WIRE-1)
//
// Run the CI "Mutation tier leg" locally, for the kernels a builder touched,
// inside WSL against the provisioned Stryker (MUTATION-TIER-LOCAL-STRYKER-1).
//
//   node scripts/local-mutation-tier.mjs [--root <repo-copy>] <kernel-id> [<kernel-id> ...]
//
// <kernel-id> is the full slug the runner reads (e.g. art-215-reg-z-appendix-j-apr).
//
// Ids are passed through argv only and validated against ^[a-z0-9-]+$.
// Run it in the BACKGROUND (a foreground call can exceed the 10-minute tool limit).
//
// Verdicts / exit codes:
//   0  PASS         every examined kernel met its tier floor(s)
//   1  FLOOR-FAIL   run completed, at least one kernel under a floor
//   4  HARD-FAIL    a kernel hard-failed (sandbox ENOENT, missing file, no report ...)
//                   or the runner died without writing its summary
//   2  not provisioned   the pinned Stryker tools dir is absent in WSL
//   3  GPU busy, deferred   /tmp/zkvm-gpu.lock is held in WSL (same flock -n -w 0
//                   read as scripts/lib/prove-lane-probe.sh); never contends with a prove
//   64 usage error
//
// SHADOW MODE: builders do NOT gate on this yet. Each run appends one line to the
// shadow log (default: <workspace>/logs/shadow/local-mutation-tier.jsonl, found by
// walking up from this repo; override with LOCAL_MUTATION_TIER_SHADOW_LOG):
//   { ts, row, kernel, verdict, wall_s, ci_verdict }   (ci_verdict null until known)
//
// PROMOTION RULE: 20 runs that agree with the CI shard verdict and 0 false reds
// before this may block a builder push.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
// --root <path> (must be the first two args): run against another checkout/copy of
// the repo (e.g. a pre-fix commit for a regression proof) instead of the one this
// script lives in.
const argv = process.argv.slice(2);
let rootOverride = null;
if (argv[0] === '--root') { rootOverride = argv[1]; argv.splice(0, 2); }
const repoRoot = rootOverride ? path.resolve(rootOverride) : path.resolve(path.dirname(__filename), '..');

export const DISTRO = 'Ubuntu-24.04';
export const TOOLS_DIR = '/root/.ain-tools/stryker-8.7.1';
export const STRYKER_BIN = `${TOOLS_DIR}/node_modules/@stryker-mutator/core/bin/stryker.js`;
export const GPU_LOCK = '/tmp/zkvm-gpu.lock';
export const ID_RE = /^[a-z0-9-]+$/;

export function validateIds(ids) {
  if (!ids.length) throw new Error('no kernel id given');
  for (const id of ids) {
    if (!ID_RE.test(id)) throw new Error(`invalid kernel id ${JSON.stringify(id)} (must match ${ID_RE})`);
  }
  return ids;
}

export function winPathToWsl(winPath) {
  const resolved = path.resolve(winPath);
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
  if (!m) throw new Error(`cannot map to a WSL path (need a drive-letter absolute path): ${resolved}`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].split(/[\\/]+/).join('/')}`;
}

/** summary = parsed --json output or null; exitCode = runner exit code. */
export function mapVerdict(summary, exitCode) {
  if (!summary || !Array.isArray(summary.results)) return 'HARD-FAIL';
  if (summary.results.some((r) => r.hardFail)) return 'HARD-FAIL';
  return exitCode === 0 ? 'PASS' : 'FLOOR-FAIL';
}

const EXIT = { PASS: 0, 'FLOOR-FAIL': 1, 'HARD-FAIL': 4 };

function wsl(script, timeoutMs) {
  return spawnSync('wsl.exe', ['-d', DISTRO, '--', 'bash', '-lc', script], {
    encoding: 'utf8', timeout: timeoutMs, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
}

function findShadowLog() {
  if (process.env.LOCAL_MUTATION_TIER_SHADOW_LOG) return process.env.LOCAL_MUTATION_TIER_SHADOW_LOG;
  let dir = repoRoot;
  for (let i = 0; i < 6; i++) {
    const cand = path.join(dir, 'logs', 'shadow');
    if (existsSync(cand)) return path.join(cand, 'local-mutation-tier.jsonl');
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

export function shadowLines(row, ids, verdict, wallS, ts = new Date().toISOString()) {
  return ids.map((kernel) => JSON.stringify({ ts, row, kernel, verdict, wall_s: wallS, ci_verdict: null })) .join('\n') + '\n';
}

function logShadow(ids, verdict, wallS) {
  const p = findShadowLog();
  if (!p) return;
  try {
    mkdirSync(path.dirname(p), { recursive: true });
    appendFileSync(p, shadowLines(process.env.MUTATION_TIER_ROW || path.basename(repoRoot), ids, verdict, wallS));
  } catch (e) {
    console.error(`local-mutation-tier: shadow log write failed: ${e.message}`);
  }
}

function main() {
  let ids;
  try { ids = validateIds(argv); } catch (e) {
    console.error(`local-mutation-tier: ${e.message}`);
    console.error('usage: node scripts/local-mutation-tier.mjs <kernel-id> [<kernel-id> ...]');
    process.exit(64);
  }

  const prov = wsl(`[ -f ${STRYKER_BIN} ] && echo PROVISIONED || echo ABSENT`, 60000);
  if (prov.error || !/PROVISIONED/.test(prov.stdout || '')) {
    console.error(`local-mutation-tier: not provisioned (${prov.error ? prov.error.message : `${STRYKER_BIN} absent in ${DISTRO}`})`);
    process.exit(2);
  }

  // Same read as prove-lane-probe.sh: lock file exists AND a zero-wait flock fails.
  const lock = wsl(`[ -e ${GPU_LOCK} ] && ! flock -n -w 0 ${GPU_LOCK} -c true && echo HELD || echo FREE`, 60000);
  if (lock.error || !/(HELD|FREE)/.test(lock.stdout || '')) {
    console.error(`local-mutation-tier: GPU-lock read unreliable (${lock.error ? lock.error.message : JSON.stringify(lock.stdout)}); refusing to start`);
    process.exit(3);
  }
  if (/HELD/.test(lock.stdout)) {
    console.error('local-mutation-tier: GPU busy, deferred');
    process.exit(3);
  }

  const wslRepo = winPathToWsl(repoRoot);
  const outRel = `.tmp/local-mutation-tier-${process.pid}.json`;
  mkdirSync(path.join(repoRoot, '.tmp'), { recursive: true });
  const outWin = path.join(repoRoot, outRel);
  const script = `cd ${wslRepo} && MUTATION_TIER_STRYKER_BIN=${STRYKER_BIN} node scripts/run-mutation-tier.mjs --kernel ${ids.join(' ')} --json ${outRel}`;

  const t0 = Date.now();
  const run = wsl(script, 3 * 60 * 60 * 1000);
  const wallS = Math.round((Date.now() - t0) / 1000);
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);

  let summary = null;
  try { summary = JSON.parse(readFileSync(outWin, 'utf8')); } catch { /* HARD-FAIL below */ }
  const verdict = mapVerdict(summary, run.status);
  console.log(`local-mutation-tier: ${verdict} kernels=${ids.join(',')} wall=${wallS}s (shadow, advisory)`);
  logShadow(ids, verdict, wallS);
  process.exit(EXIT[verdict]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
