#!/usr/bin/env node
/**
 * scripts/ci/coarm-gates.mjs — LINEAGE-COARM-1 verdict producer.
 *
 * auto-arm.mjs may co-arm a second lineage PR beside an armed one only when a
 * verdict with ok:true exists for EXACTLY that set, bound to main's tip and to
 * each PR's head sha (coarmDecision). A clean textual merge is not enough: the
 * ejects measured Nov 1-25 that a merge test misses were stale proof links
 * after a record rename (#3278, dead-link gate), SPEC.md drift making records
 * stale (#2831, kernel-resolve gate) and an ID collision across queue entries
 * (#2524). So this script builds the combined tree (main + each PR merged in
 * order, in a throwaway worktree) and RUNS the cross-PR gates on it:
 *
 *   - registry kernel-resolve current   node scripts/gen-registry-kernel-resolve.mjs --check
 *   - dead links                        node scripts/dead-link-check.mjs
 *   - hash golden parity                node chaingraph/kernels/golden-parity.test.mjs
 *   - ID collisions                     node scripts/check-id-collision.mjs
 *
 * Any conflict, missing commit, sha mismatch or gate failure gives ok:false.
 *
 * SECURITY: the gates execute PR code. Run this ONLY where no write token is
 * reachable (a job with contents:read and persist-credentials:false, or a
 * local clone). The child processes get an environment with every *TOKEN*
 * variable removed, but a token in this process's own environment is still
 * readable by same-user children, so the script refuses to start when one is
 * set unless --allow-token-env is passed (local use with a read-only token).
 *
 * Usage:
 *   node scripts/ci/coarm-gates.mjs --base <main sha> --pr <n>:<head sha> --pr <n>:<head sha>
 *        [--out verdicts.json] [--append] [--allow-token-env] [--fetch]
 *   --fetch  git fetch origin pull/<n>/head for each PR first (needs network).
 * Prints the verdict JSON; --out writes (or with --append, adds to) a JSON
 * array that auto-arm.mjs reads from $AUTO_ARM_COARM_VERDICTS.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from '../_git-env-lib.mjs';

export const GATES = Object.freeze([
  ['registry-kernel-resolve', ['scripts/gen-registry-kernel-resolve.mjs', '--check']],
  ['dead-link', ['scripts/dead-link-check.mjs']],
  ['golden-parity', ['chaingraph/kernels/golden-parity.test.mjs']],
  ['id-collision', ['scripts/check-id-collision.mjs']],
]);
export const GATE_TIMEOUT_MS = 15 * 60_000;
const SHA = /^[0-9a-f]{40}$/;

export function parseArgs(argv) {
  const o = { base: null, prs: [], out: null, append: false, allowTokenEnv: false, fetch: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === '--base') o.base = next();
    else if (a === '--pr') {
      const m = /^(\d+):([0-9a-f]{40})$/.exec(next());
      if (!m) throw new Error('--pr takes <number>:<40-hex head sha>');
      o.prs.push({ number: Number(m[1]), headSha: m[2] });
    } else if (a === '--out') o.out = next();
    else if (a === '--append') o.append = true;
    else if (a === '--allow-token-env') o.allowTokenEnv = true;
    else if (a === '--fetch') o.fetch = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!o.base || !SHA.test(o.base)) throw new Error('--base takes main\'s 40-hex tip sha');
  if (o.prs.length < 2) throw new Error('give at least two --pr entries (the armed PR and the candidate)');
  if (new Set(o.prs.map((p) => p.number)).size !== o.prs.length) throw new Error('duplicate --pr number');
  return o;
}

// Environment for PR code: no credentials of any kind.
export function scrubEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (/TOKEN|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}
export const tokenVars = (env) => Object.keys(env).filter((k) => /(^|_)TOKEN(_FILE)?$/i.test(k) && env[k]);

// Merge a new verdict into an existing array, replacing any older verdict for the same PR numbers.
export function mergeVerdicts(existing, v) {
  const nums = (x) => (x.prs || []).map((p) => p.number).sort((a, b) => a - b).join(',');
  const list = Array.isArray(existing) ? existing.filter((x) => x && nums(x) !== nums(v)) : [];
  list.push(v);
  return list;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const bad = tokenVars(process.env);
  if (bad.length && !o.allowTokenEnv) {
    console.error(`refusing: ${bad.join(', ')} set; PR code would run beside a token (pass --allow-token-env only for a local read-only token)`);
    return 2;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const repo = resolve(here, '../..');
  // No credentials and no ambient GIT_* (a pre-push hook's GIT_DIR would point git at the wrong tree).
  const childEnv = gitEnv({}, scrubEnv(process.env));
  const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, env: gitEnv({}, childEnv) });
  const verdict = { base: o.base, prs: o.prs.map(({ number, headSha }) => ({ number, headSha })), ok: false, gates: {}, at: new Date().toISOString() };
  const finish = (why) => {
    if (why) verdict.reason = why;
    const s = JSON.stringify(verdict, null, 2);
    console.log(s);
    if (o.out) {
      let prev = [];
      if (o.append && existsSync(o.out)) { try { prev = JSON.parse(readFileSync(o.out, 'utf8')); } catch { prev = []; } }
      writeFileSync(o.out, JSON.stringify(o.append ? mergeVerdicts(prev, verdict) : [verdict], null, 2) + '\n');
    }
    return verdict.ok ? 0 : 1;
  };
  if (o.fetch) {
    for (const p of o.prs) {
      try { git(['fetch', '--quiet', 'origin', `pull/${p.number}/head`]); } catch (e) { return finish(`fetch #${p.number} failed: ${String(e.stderr || e.message).split('\n')[0]}`); }
    }
  }
  for (const s of [o.base, ...o.prs.map((p) => p.headSha)]) {
    try { git(['cat-file', '-e', `${s}^{commit}`]); } catch { return finish(`commit ${s.slice(0, 12)} not in this clone (fetch it, or pass --fetch)`); }
  }
  const wt = mkdtempSync(join(tmpdir(), 'coarm-'));
  rmSync(wt, { recursive: true, force: true });
  try {
    git(['worktree', 'add', '--detach', '--quiet', wt, o.base]);
    const gitWt = (args) => git(['-c', 'user.name=coarm-gates', '-c', 'user.email=coarm-gates@invalid', ...args], wt);
    for (const p of o.prs) {
      try { gitWt(['merge', '--no-ff', '--no-edit', '--quiet', p.headSha]); } catch (e) {
        try { gitWt(['merge', '--abort']); } catch { /* nothing to abort */ }
        return finish(`merge of #${p.number} onto the set conflicts`);
      }
    }
    verdict.tree = gitWt(['rev-parse', 'HEAD^{tree}']).trim();
    let allOk = true;
    for (const [name, args] of GATES) {
      if (!existsSync(join(wt, args[0]))) { verdict.gates[name] = 'missing'; allOk = false; continue; }
      const t0 = Date.now();
      const r = spawnSync(process.execPath, args, { cwd: wt, env: childEnv, encoding: 'utf8', timeout: GATE_TIMEOUT_MS, maxBuffer: 64 << 20 });
      const pass = r.status === 0;
      verdict.gates[name] = pass ? 'pass' : (r.error ? `error:${r.error.code || r.error.message}` : `fail:${r.status}`);
      if (!pass) {
        allOk = false;
        const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-5).join('\n');
        console.error(`── ${name} failed (${Math.round((Date.now() - t0) / 1000)}s):\n${tail}`);
      }
    }
    verdict.ok = allOk;
    return finish(allOk ? null : 'a gate failed on the combined tree');
  } finally {
    try { git(['worktree', 'remove', '--force', wt]); } catch { rmSync(wt, { recursive: true, force: true }); }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = main();
