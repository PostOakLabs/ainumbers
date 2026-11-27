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
//
// MQ-EJECT-HOLD-OWN-CHANGE-1 (2026-11-25): any `synchronize` used to clear the
// hold, so a refresh from main (a main-watch merge, a bot-sync, an autofix
// commit) cleared a hold on a PR-owned failure and the same broken change was
// re-armed (#3278: ejected 09:33, cleared 09:56 by a merge-from-main, re-armed
// 10:34). The hold comment now also records the eject class, and
//   node scripts/mq-eject-hold.mjs should-clear <owner/repo> <pr> <base> <before> <after>
// clears the label only when the PR's own diff against <base> changed between
// <before> and <after>, or when the hold says main moving on caused it
// (mainMovedCause: a MAIN_MOVED_KINDS class or a MAIN_MOVED_STEPS step). It
// prints one JSON verdict line and exits 0 to clear, 1 to keep. Anything it
// cannot read clears (the old behaviour).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LABEL = 'mq-ejected';
const MARKER = 'merge-queue: ejected';
const SHA_RE = /\bhead ([0-9a-f]{7,40})\b/;
const CLASS_RE = /\bclass ([a-z][a-z-]*)\b/;

// Eject classes (scripts/mq-eject-classify.mjs) caused by main moving on, not by
// the PR's own change: a refresh from main alone may clear these holds.
export const MAIN_MOVED_KINDS = new Set(['derived-gate']);

// Workflow steps that main owns: a failure here comes from main moving on even
// when the classifier calls it `other`. The freshness steps fail when main's
// generated files moved (pr-sync-main.mjs also repairs a red head on them).
// The dead-link gate fails when a page on main still links a record the PR
// renamed; it is not a DERIVED_ROOT_GATES command, so its ejects are classed
// `other` (#3278 merged after one merge of main).
export const MAIN_OWNED_FRESHNESS_STEPS = Object.freeze(new Set([
  'Derived-freshness, index-sync, sitemap (HARD on merge_group)',
  'chaingraph.json shard freshness (CGSHARD-1 CS-1)',
  'Count-drift gate (advisory on PR, HARD on merge_group via DERIVED_ROOT, blocking on main)',
  'Manifest examples drift (HARD on pull_request — per-PR derivables promotion)',
  'Ask-agent block freshness (HARD on pull_request — per-PR derivables promotion)',
]));
export const MAIN_MOVED_STEPS = Object.freeze(new Set(['Dead-link gate', ...MAIN_OWNED_FRESHNESS_STEPS]));

// The one rule for "main moving on caused this eject", shared by the hold
// (clearVerdict, holdComment) and bot-sync (scripts/ci/pr-sync-main.mjs), so a
// merge of main that bot-sync forces always lifts the hold. `step` is the
// "<job> / <step>" the hold records; only its last part is matched. Returns
// the reason, or null.
export function mainMovedCause({ kind, step }) {
  if (kind && MAIN_MOVED_KINDS.has(kind)) return kind;
  if (typeof step !== 'string' || !step) return null;
  const last = step.includes(' / ') ? step.slice(step.lastIndexOf(' / ') + 3) : step;
  return MAIN_MOVED_STEPS.has(last) ? `step:${last}` : null;
}

export function holdComment({ workflow, step, runId, sha, kind }) {
  const cls = kind ? `, class ${kind}` : '';
  const how = mainMovedCause({ kind, step })
    ? 'push a commit or merge main in to clear'
    : "push a commit that changes this PR's own files to clear (a merge from main alone does not)";
  return `${MARKER} for a failed check (workflow ${workflow}, step ${step}, run ${runId}), head ${sha}${cls}. `
    + `Not re-armed at this head: ${how} the \`${LABEL}\` label.`;
}

export function recordedClass(body) {
  const m = CLASS_RE.exec(String(body));
  return m ? m[1] : null;
}

const STEP_RE = /\bstep (.+), run \d+\)/;
export function recordedStep(body) {
  const m = STEP_RE.exec(String(body));
  return m ? m[1] : null;
}

/** mainMovedCause() for a hold comment's recorded class and step. Pure. */
export function holdMainMovedCause(body) {
  return mainMovedCause({ kind: recordedClass(body), step: recordedStep(body) });
}

// filename -> status:blob for a compare API `files` list. A rename also keys
// its old name, so renaming a file counts as a change.
function diffKey(files) {
  const m = new Map();
  for (const f of files) {
    m.set(f.filename, `${f.status}:${f.sha ?? ''}`);
    if (f.previous_filename) m.set(f.previous_filename, `renamed-to:${f.filename}`);
  }
  return m;
}

/** True when the PR's own changed files (path, status, blob) differ. Pure. */
export function ownDiffMoved(beforeFiles, afterFiles) {
  const a = diffKey(beforeFiles);
  const b = diffKey(afterFiles);
  if (a.size !== b.size) return true;
  for (const [k, v] of a) if (b.get(k) !== v) return true;
  return false;
}

/**
 * Decide whether a `synchronize` clears the hold. Pure.
 * holdBody: the newest hold comment, or null.
 * before / after: { files, complete } for the PR's own diff (base...sha) at the
 * old and new head, or null when it could not be read. `complete` is false when
 * the compare API cut the file list short.
 * Returns { clear, reason }.
 */
export function clearVerdict({ holdBody, before, after }) {
  if (!holdBody || recordedSha(holdBody) === null) return { clear: true, reason: 'no-hold-record' };
  if (!before || !after || !before.complete || !after.complete) return { clear: true, reason: 'own-diff-unknown' };
  if (ownDiffMoved(before.files, after.files)) return { clear: true, reason: 'own-files-changed' };
  const cause = holdMainMovedCause(holdBody);
  if (cause) return { clear: true, reason: `eject-from-main-move:${cause}` };
  return { clear: false, reason: `main-refresh-only:${recordedClass(holdBody) ?? 'unclassified'}` };
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

// The compare API lists at most 300 files.
const COMPARE_FILE_CAP = 300;

// The PR's own diff at `sha`: files changed since its merge base with `base`.
export function prDiff(repo, base, sha, gh = ghJson) {
  try {
    const files = gh(['api', `repos/${repo}/compare/${encodeURIComponent(base)}...${sha}`,
      '--jq', '[.files[] | {filename, status, sha, previous_filename}]']);
    if (!Array.isArray(files)) return null;
    return { files, complete: files.length < COMPARE_FILE_CAP };
  } catch {
    return null;
  }
}

// Newest hold comment on the PR, or null.
export function newestHoldComment(repo, pr, gh = ghLines) {
  try {
    const bodies = gh(['api', `repos/${repo}/issues/${pr}/comments?per_page=100`, '--paginate',
      '--jq', '.[].body']);
    const list = Array.isArray(bodies) ? bodies : [];
    return list.filter(isHoldComment).at(-1) ?? null;
  } catch {
    return null;
  }
}

// `--paginate --jq '.[].body'` prints one JSON string per line, not an array.
function ghLines(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (args.includes('--paginate')) return out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return JSON.parse(out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'should-clear') {
    const [repo, pr, base, before, after] = a;
    const v = clearVerdict({
      holdBody: newestHoldComment(repo, pr, ghLines),
      before: prDiff(repo, base, before, ghLines),
      after: prDiff(repo, base, after, ghLines),
    });
    console.log(JSON.stringify(v));
    process.exit(v.clear ? 0 : 1);
  } else if (cmd === 'find-run') {
    const id = findEjectRun(a[0], a[1]);
    if (id !== null) console.log(id);
  } else if (cmd === 'comment') {
    const [workflow, step, runId, sha, kind] = a;
    console.log(holdComment({ workflow, step, runId, sha, kind }));
  } else if (cmd === 'held') {
    process.exit(recordedSha(readFileSync(0, 'utf8')) === a[0] ? 0 : 1);
  } else {
    console.error('usage: mq-eject-hold.mjs comment <workflow> <step> <run-id> <head-sha> [class] | held <head-sha> | find-run <owner/repo> <pr> | should-clear <owner/repo> <pr> <base> <before> <after>');
    process.exit(2);
  }
}
