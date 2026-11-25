#!/usr/bin/env node
// Bookkeeping for automerge-label.yml's merge-queue eject hold.
// A PR dequeued for a failed check gets the `mq-ejected` label plus ONE comment
// that names the failing workflow, step and run and records the head sha it
// failed at. While the label is present and the head is unchanged nothing
// re-arms the PR; a new head clears it (workflow `synchronize` path).
//   node scripts/mq-eject-hold.mjs comment <workflow> <step> <run-id> <head-sha>
//     prints the comment body.
//   node scripts/mq-eject-hold.mjs held <head-sha> < comment-body
//     exits 0 when the recorded sha equals <head-sha>, 1 otherwise.
//   node scripts/mq-eject-hold.mjs find-run <owner/repo> <pr>
//     prints the id of the merge_group run that ejected <pr>, or nothing.
//
// MQ-EJECT-CANCELLED-RUN-1 (2026-11-25): the eject run lookup used to ask the
// API for merge_group runs with status=failure. When a required job fails, the
// queue drops the entry and the rest of that workflow run is cancelled, so the
// run's own conclusion is `cancelled`, not `failure`. Nov 15-24: 39 of 45
// failed merge_group runs concluded `cancelled` (each with a failed job), so
// the lookup found nothing, the hold was never applied, and the same head was
// re-armed and re-queued (#3222: 16 removals on one failing gate, dragging
// #3225/#3263/#3265 out with it). pickEjectRun() reads a run as the ejecting
// run when it concluded `failure`, or concluded `cancelled` / is unfinished
// with at least one failed job.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LABEL = 'mq-ejected';
const MARKER = 'merge-queue: ejected';
const SHA_RE = /\bhead ([0-9a-f]{7,40})\b/;

export function holdComment({ workflow, step, runId, sha }) {
  return `${MARKER} for a failed check (workflow ${workflow}, step ${step}, run ${runId}), head ${sha}. `
    + `Not re-armed at this head: push a new commit to clear the \`${LABEL}\` label.`;
}

export function isHoldComment(body) {
  return String(body).startsWith(MARKER);
}

export function recordedSha(body) {
  const m = SHA_RE.exec(String(body));
  return m ? m[1] : null;
}

// Held while the label is present and the comment's recorded head is the live head.
export function isHeld(labels, headSha, commentBody) {
  if (!labels.includes(LABEL)) return false;
  const rec = recordedSha(commentBody);
  return rec !== null && rec === headSha;
}

export const queuePrefix = (pr) => `gh-readonly-queue/main/pr-${pr}-`;

/**
 * Pick the merge_group run that ejected `pr`. Pure.
 * runs: [{id, head_branch, created_at, status, conclusion}] (any order, any PR).
 * hasFailedJob(id): true when that run has a job that concluded `failure`
 * (only asked for cancelled or unfinished runs of this PR).
 * Newest qualifying run wins. Returns the run id, or null.
 */
export function pickEjectRun(runs, pr, hasFailedJob) {
  const mine = (Array.isArray(runs) ? runs : [])
    .filter((r) => r && typeof r.head_branch === 'string' && r.head_branch.startsWith(queuePrefix(pr)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const r of mine) {
    if (r.conclusion === 'failure') return r.id;
    if (r.conclusion === 'cancelled' || r.status !== 'completed') {
      if (hasFailedJob(r.id)) return r.id;
    }
  }
  return null;
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

// The I/O half of find-run: newest 100 merge_group runs, then the jobs of
// this PR's cancelled or unfinished runs only.
export function findEjectRun(repo, pr, gh = ghJson) {
  const runs = gh(['api', `repos/${repo}/actions/runs?event=merge_group&per_page=100`,
    '--jq', '[.workflow_runs[] | {id, head_branch, created_at, status, conclusion}]']);
  return pickEjectRun(runs, pr, (id) => {
    const failed = gh(['api', `repos/${repo}/actions/runs/${id}/jobs?per_page=100&filter=latest`,
      '--jq', '[.jobs[] | select(.conclusion == "failure") | .id]']);
    return Array.isArray(failed) && failed.length > 0;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'find-run') {
    const id = findEjectRun(a[0], a[1]);
    if (id !== null) console.log(id);
  } else if (cmd === 'comment') {
    const [workflow, step, runId, sha] = a;
    console.log(holdComment({ workflow, step, runId, sha }));
  } else if (cmd === 'held') {
    process.exit(recordedSha(readFileSync(0, 'utf8')) === a[0] ? 0 : 1);
  } else {
    console.error('usage: mq-eject-hold.mjs comment <workflow> <step> <run-id> <head-sha> | held <head-sha> | find-run <owner/repo> <pr>');
    process.exit(2);
  }
}
