#!/usr/bin/env node
// MUTATION-TIER-VERDICT-REUSE-1 — merge_group seeding of the mutation verdict store.
//
// A merge_group run cannot read the PR branch's actions/cache (cache scope is the ref), so the
// PR run uploads its verdict directory as an ARTIFACT (artifacts are addressable by run id from
// any ref) and this script downloads it. Steps: queue ref -> PR number -> PR head SHA -> latest
// completed Scripts Verify pull_request run for that head whose "Mutation tier leg" jobs ALL
// succeeded -> download the shard's artifact -> copy only the records whose key this runner
// recomputes as EQUAL on the queue tree into MUTATION_VERDICT_DIR.
//
// FAIL-OPEN TO RUNNING, never to skipping: any API error, missing run, red shard, missing
// artifact or key mismatch leaves MUTATION_VERDICT_DIR without that record, so the tier runs the
// kernel as today. The runner re-verifies every key itself, so a seeded record can only skip a
// kernel whose inputs are byte-identical to a PASSED run. Always exits 0.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kernelVerdictKey } from '../run-mutation-tier.mjs';

const WORKFLOW_FILE = 'scripts-verify.yml';
const TIER_JOB_PREFIX = 'Mutation tier leg';

export function prNumberFromQueueRef(ref) {
  const m = /gh-readonly-queue\/[^/]+\/pr-(\d+)-[0-9a-f]+$/.exec(String(ref || ''));
  return m ? Number(m[1]) : null;
}

export function defaultGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

// Returns the run id of the newest completed pull_request run for `headSha` whose every
// "Mutation tier leg" job concluded success, or null.
export function findGreenRun({ gh, repo, headSha }) {
  const runs = JSON.parse(gh(['api', `repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?event=pull_request&status=completed&head_sha=${headSha}&per_page=20`])).workflow_runs || [];
  runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const run of runs) {
    const jobs = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`])).jobs || [];
    const tier = jobs.filter((j) => String(j.name).startsWith(TIER_JOB_PREFIX));
    if (tier.length > 0 && tier.every((j) => j.conclusion === 'success')) return run.id;
  }
  return null;
}

// Copies equal-key PASS records from downloadDir to verdictDir; returns { copied, rejected }.
export function copyMatchingRecords({ downloadDir, verdictDir, repoRoot, keyFor = kernelVerdictKey }) {
  let copied = 0;
  let rejected = 0;
  if (!existsSync(downloadDir)) return { copied, rejected };
  mkdirSync(verdictDir, { recursive: true });
  for (const f of readdirSync(downloadDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(readFileSync(path.join(downloadDir, f), 'utf8'));
      if (!rec || rec.verdict !== 'PASS' || typeof rec.kernel !== 'string' || typeof rec.key !== 'string') { rejected++; continue; }
      if (f !== `${rec.kernel}.${rec.key}.json`) { rejected++; continue; }
      const equal = [false, true].some((dec) => keyFor(rec.kernel, repoRoot, dec) === rec.key);
      if (!equal) { rejected++; continue; }
      copyFileSync(path.join(downloadDir, f), path.join(verdictDir, f));
      copied++;
    } catch { rejected++; }
  }
  return { copied, rejected };
}

export function seedVerdicts({ env = process.env, gh = defaultGh, repoRoot, log = console.log, keyFor = kernelVerdictKey } = {}) {
  const verdictDir = env.MUTATION_VERDICT_DIR;
  const repo = env.REPO;
  if (!verdictDir || !repo) { log('mutation-verdict-from-pr: MUTATION_VERDICT_DIR or REPO unset — nothing seeded, tier runs as today'); return { seeded: 0, reason: 'unset' }; }
  try {
    const pr = prNumberFromQueueRef(env.QUEUE_REF);
    if (!pr) { log(`mutation-verdict-from-pr: ref "${env.QUEUE_REF}" is not a queue ref — nothing seeded`); return { seeded: 0, reason: 'not-queue-ref' }; }
    const headSha = String(gh(['api', `repos/${repo}/pulls/${pr}`, '--jq', '.head.sha'])).trim();
    if (!/^[0-9a-f]{40}$/.test(headSha)) { log('mutation-verdict-from-pr: could not read the PR head SHA — nothing seeded'); return { seeded: 0, reason: 'no-head' }; }
    const runId = findGreenRun({ gh, repo, headSha });
    if (!runId) { log(`mutation-verdict-from-pr: no completed pull_request run with all Mutation tier legs green for ${headSha.slice(0, 12)} — nothing seeded`); return { seeded: 0, reason: 'no-green-run' }; }
    const shard = env.VERDICT_SHARD;
    const name = shard !== undefined && shard !== '' ? `mutation-verdicts-${shard}` : null;
    const downloadDir = mkdtempSync(path.join(os.tmpdir(), 'mutation-verdicts-dl-'));
    gh(['run', 'download', String(runId), '--repo', repo, '--dir', downloadDir, ...(name ? ['--name', name] : ['--pattern', 'mutation-verdicts-*'])]);
    // `--pattern` nests each artifact in a subdirectory; flatten one level when no name was given.
    const dirs = name ? [downloadDir] : [downloadDir, ...readdirSync(downloadDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(downloadDir, e.name))];
    let copied = 0;
    let rejected = 0;
    for (const d of dirs) {
      const r = copyMatchingRecords({ downloadDir: d, verdictDir, repoRoot, keyFor });
      copied += r.copied;
      rejected += r.rejected;
    }
    log(`mutation-verdict-from-pr: PR #${pr} head ${headSha.slice(0, 12)} run ${runId}: seeded ${copied} record(s), rejected ${rejected} (key mismatch or malformed)`);
    return { seeded: copied, rejected, runId };
  } catch (e) {
    log(`mutation-verdict-from-pr: ${String(e && e.message ? e.message : e).split('\n')[0]} — nothing seeded, tier runs as today`);
    return { seeded: 0, reason: 'error' };
  }
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  seedVerdicts({ repoRoot });
  process.exit(0);
}
