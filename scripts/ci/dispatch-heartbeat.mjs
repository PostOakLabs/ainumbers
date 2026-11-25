#!/usr/bin/env node
// Is the queue drain still being driven? Run on every merge to main by
// .github/workflows/dispatch-heartbeat.yml.
//
// Three jobs drain the merge queue between merges: automerge-label.yml's
// rearm-recovered, pr-autofix.yml's sync-main drain and auto-arm.yml. Each runs
// on a cron and on workflow_dispatch. GitHub delivers few of those crons
// (measured over 72h to 2026-11-25: auto-arm 8 of 216 slots, automerge-label 7
// of 72, pr-autofix 8 of 216), so an external scheduler's workflow_dispatch
// calls are what actually drive them (88, 139 and 100 dispatches in the same
// 72h). When that scheduler stops, nothing on GitHub says so: recovered PRs
// stop being re-armed and the sync drain stops, quietly.
//
// This reads the newest schedule or workflow_dispatch run of each drain
// workflow and reports red when the newest of them all is older than
// QUIET_MINUTES. Report only: it opens or updates one tracking issue through
// scripts/scheduled-red-issue.mjs (surface `dispatch-heartbeat`) and closes it
// on the next merge that finds the drain fresh.
//
//   node scripts/ci/dispatch-heartbeat.mjs <owner/repo> [--now <iso>]
// prints one JSON line { state, newest, workflow, ageMinutes, line } and exits
// 0. Runs it cannot read count as missing; none readable at all is red.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DRAIN_WORKFLOWS = ['automerge-label.yml', 'pr-autofix.yml', 'auto-arm.yml'];
export const QUIET_MINUTES = 60;
const DRIVING_EVENTS = new Set(['schedule', 'workflow_dispatch']);

/**
 * runs: [{ workflow, event, created_at }] across the drain workflows (any order).
 * Returns { state: 'red'|'green', newest, workflow, ageMinutes, line }. Pure.
 */
export function heartbeat(runs, now, quietMinutes = QUIET_MINUTES) {
  const nowMs = Date.parse(now);
  let best = null;
  for (const r of Array.isArray(runs) ? runs : []) {
    if (!r || !DRIVING_EVENTS.has(r.event)) continue;
    const t = Date.parse(r.created_at);
    if (Number.isNaN(t)) continue;
    if (!best || t > best.t) best = { t, workflow: r.workflow, created_at: r.created_at };
  }
  if (!best) {
    return {
      state: 'red', newest: null, workflow: null, ageMinutes: null,
      line: `no schedule or workflow_dispatch run of ${DRAIN_WORKFLOWS.join(', ')} could be read`,
    };
  }
  const ageMinutes = Math.floor((nowMs - best.t) / 60000);
  const state = ageMinutes > quietMinutes ? 'red' : 'green';
  const line = state === 'red'
    ? `queue drain quiet ${ageMinutes} min (over ${quietMinutes}): newest driven run ${best.workflow} at ${best.created_at}`
    : `queue drain fresh: ${best.workflow} ran ${ageMinutes} min ago`;
  return { state, newest: best.created_at, workflow: best.workflow, ageMinutes, line };
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
}

// Newest few schedule and dispatch runs of each drain workflow. A workflow
// that cannot be read contributes nothing.
export function readRuns(repo, gh = ghJson) {
  const out = [];
  for (const wf of DRAIN_WORKFLOWS) {
    for (const event of DRIVING_EVENTS) {
      try {
        const runs = gh(['api', `repos/${repo}/actions/workflows/${wf}/runs?event=${event}&per_page=3`,
          '--jq', '[.workflow_runs[] | {event, created_at}]']);
        for (const r of Array.isArray(runs) ? runs : []) out.push({ workflow: wf, ...r });
      } catch {
        // unreadable: counts as missing
      }
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const repo = args[0];
  const i = args.indexOf('--now');
  const now = i >= 0 ? args[i + 1] : new Date().toISOString();
  if (!repo) {
    console.error('usage: dispatch-heartbeat.mjs <owner/repo> [--now <iso>]');
    process.exit(2);
  }
  console.log(JSON.stringify(heartbeat(readRuns(repo), now)));
}
