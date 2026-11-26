#!/usr/bin/env node
/**
 * dispatch-mutation-tier.mjs - run the REAL CI mutation tier for named kernels on demand.
 *
 * Usage:
 *   node scripts/dispatch-mutation-tier.mjs <ref> <kernel-id>... [--workflow-ref <ref>] [--no-wait]
 *
 *   <ref>           branch, tag or sha whose kernels are tested (the workflow's `ref` input)
 *   <kernel-id>...  one or more kernel ids, each matching [a-z0-9-]+
 *   --workflow-ref  ref the workflow file itself is dispatched from (default: main)
 *   --no-wait       print the run URL and stop
 *
 * What it does: runs `gh workflow run mutation-full-scheduled.yml` with the `kernels`
 * and `ref` inputs, finds the new run id, prints the run URL, then (unless --no-wait)
 * waits for the run to end, downloads the `mutation-kernels` artifact and prints one
 * verdict line per kernel (killed/total for the money-math and peripheral tiers).
 *
 * Notes: needs an authenticated `gh`. It never edits board state, never pushes, and
 * spawns gh with an argv array (no shell), so ids cannot inject. Exit 0 = dispatched
 * and (when waiting) every kernel measured; 1 = a run failure or an unmeasured kernel;
 * 2 = bad usage.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WORKFLOW = 'mutation-full-scheduled.yml';
export const KERNEL_RE = /^[a-z0-9-]+$/;
export const KERNELS_INPUT_RE = /^[a-z0-9-]+( [a-z0-9-]+)*$/;
export const REF_RE = /^[A-Za-z0-9._/-]+$/;

/** Validate argv-level inputs; returns { ok, error, kernelsInput }. */
export function validateInputs(ref, kernels) {
  if (typeof ref !== 'string' || !REF_RE.test(ref) || ref.startsWith('-')) return { ok: false, error: 'bad ref: ' + JSON.stringify(ref) };
  if (!Array.isArray(kernels) || kernels.length === 0) return { ok: false, error: 'at least one kernel id is required' };
  for (const k of kernels) if (typeof k !== 'string' || !KERNEL_RE.test(k)) return { ok: false, error: 'bad kernel id: ' + JSON.stringify(k) };
  const kernelsInput = kernels.join(' ');
  if (!KERNELS_INPUT_RE.test(kernelsInput)) return { ok: false, error: 'kernels input failed validation' };
  return { ok: true, kernelsInput };
}

/** One verdict line per kernel from a run-mutation-tier --json document. */
export function verdictLines(doc, wanted) {
  const byId = new Map((doc.results || []).map((r) => [r.id, r]));
  const tier = (t) => (t && Number.isFinite(t.killed) && Number.isFinite(t.total) ? t.killed + '/' + t.total : 'n/a');
  return wanted.map((id) => {
    const r = byId.get(id);
    if (!r) return { id, measured: false, line: id + ': NOT IN SCAN RESULT' };
    if (r.hardFail) return { id, measured: false, line: id + ': HARD-FAIL ' + String(r.hardFail) };
    return { id, measured: true, line: id + ': money-math ' + tier(r.tiers && r.tiers.moneyMath) + '  peripheral ' + tier(r.tiers && r.tiers.peripheral) };
  });
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

function main(argv) {
  const rest = [];
  let workflowRef = 'main';
  let wait = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workflow-ref') workflowRef = argv[++i];
    else if (argv[i] === '--no-wait') wait = false;
    else rest.push(argv[i]);
  }
  const [ref, ...kernels] = rest;
  const v = validateInputs(ref, kernels);
  if (!v.ok || !REF_RE.test(workflowRef || '')) {
    console.error('usage: node scripts/dispatch-mutation-tier.mjs <ref> <kernel-id>... [--workflow-ref <ref>] [--no-wait]\n' + (v.error || 'bad --workflow-ref'));
    return 2;
  }
  const since = Date.now() - 5000;
  gh(['workflow', 'run', WORKFLOW, '--ref', workflowRef, '-f', 'kernels=' + v.kernelsInput, '-f', 'ref=' + ref, '-f', 'dry_run=false']);

  // Find the run this dispatch created (newest workflow_dispatch run created after `since`).
  let run = null;
  for (let attempt = 0; attempt < 12 && !run; attempt++) {
    if (attempt) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},5000)']);
    const list = JSON.parse(gh(['run', 'list', '--workflow', WORKFLOW, '--event', 'workflow_dispatch', '--limit', '10', '--json', 'databaseId,createdAt,url']));
    run = list.filter((r) => Date.parse(r.createdAt) >= since).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
  }
  if (!run) { console.error('dispatched, but the new run was not found; check: gh run list --workflow ' + WORKFLOW); return 1; }
  console.log('RUN: ' + run.url);
  if (!wait) return 0;

  try { gh(['run', 'watch', String(run.databaseId), '--exit-status']); } catch { console.error('run did not finish green; looking for the artifact anyway'); }
  const dir = mkdtempSync(join(tmpdir(), 'mutation-kernels-'));
  try { gh(['run', 'download', String(run.databaseId), '-n', 'mutation-kernels', '-D', dir]); } catch { console.error('no mutation-kernels artifact (the scan wrote no JSON): ' + run.url); return 1; }
  const f = readdirSync(dir).find((n) => n.endsWith('.json'));
  if (!f) { console.error('artifact held no JSON: ' + run.url); return 1; }
  const lines = verdictLines(JSON.parse(readFileSync(join(dir, f), 'utf8')), kernels);
  for (const l of lines) console.log(l.line);
  return lines.every((l) => l.measured) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
