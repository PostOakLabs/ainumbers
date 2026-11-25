#!/usr/bin/env node
// auto-arm.mjs — AUTO-ARM-ON-GREEN-1. Mechanises ORCH's arm rule: ONE
// `automerge` label on a PR that is green on its CURRENT head, whose merge ref
// has main's tip as first parent (CURE-SEQUENCE-1, ORCH-AUTOBOOT-PROMPT.md;
// V655: "update-branch, confirm a fresh merge ref, fresh green, ONE automerge
// label"; V658 serial lane: lineage PRs one at a time).
//
// The decision is a PURE function (decide) so every condition is fixture-
// testable (auto-arm.test.mjs). The CLI wraps it with `gh` calls.
//
// Labels a PR ONLY when ALL hold:
//   (c) its head branch is in scripts/ci/auto-arm-allow.json (branch -> row id)
//   (f) not draft, no `hold` label
//   (d) the diff touches no .github/workflows/**
//   (a) every REQUIRED check is green on the current head
//   (b) merge ref's first parent is main's tip (else update-branch once, wait)
//   (e) PACKING: a lineage-class PR (chaingraph/kernels/ or registry/) arms
//       only if no other lineage-class PR is labelled or queued, and only if
//       it is the first open branch in allow.lineage (the serial baton).
//       PARALLEL (opt-in, off unless the caller passes ctx.lineageParallel): a
//       MAINSIDE lineage PR (its diff carries no registry/ path, no
//       chaingraph/kernels/registry-lineage-records.json and no
//       chaingraph/receipt-bundles/ change, because the post-merge regen writes
//       those) skips the baton and may be armed beside other mainside PRs, up to
//       ctx.lineageParallel.max armed at once, only when the changed files are
//       disjoint (the shared single files in SHARED_RESIDUAL count as overlap
//       whenever either PR touches them). A PR that still carries a registry
//       write ("serial" class) keeps the baton and needs zero other lineage
//       PRs armed or queued.
//       CO-ARM (opt-in, off unless AUTO_ARM_LINEAGE_COARM=1, LINEAGE-COARM-1):
//       a second lineage PR whose only registry write is its own kernel
//       record may arm beside one armed lineage PR when a gate verdict on the
//       exact combined tree is green; see coarmDecision() for every condition.
// Never removes labels, never merges, never touches non-allowlisted PRs.
//
// Usage: node scripts/ci/auto-arm.mjs [--dry-run] [--repo OWNER/NAME]
//   --dry-run  print the decision per open PR, change nothing.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const LABEL = 'automerge';
export const LINEAGE_PREFIXES = ['chaingraph/kernels/', 'registry/'];

// Tooling-only files directly under chaingraph/kernels/ cannot move the
// lineage key set, so they do not make a PR lineage-class on their own:
// the shared hash helper, gen-* generators (except gen-index.mjs), lint-*,
// fix-* and check-* scripts, and *.test.mjs / *.selftest.mjs files.
// Mirrors the workspace classifier scripts/lib/lineage-class.mjs exactly.
export const LINEAGE_TOOLING_EXEMPT =
  /^chaingraph\/kernels\/(?:_hash\.mjs|gen-(?!index\.mjs$)[^/]*\.mjs|(?:lint|fix|check)-[^/]*\.mjs|[^/]*\.(?:test|selftest)\.mjs)$/;

export const isLineageClass = (files) =>
  files.some((f) => LINEAGE_PREFIXES.some((p) => f.startsWith(p))
    && !LINEAGE_TOOLING_EXEMPT.test(f));

// Paths only the post-merge regen may write. A lineage-class PR carrying one is "serial"; one carrying none is "mainside".
export const LINEAGE_LOG_FILE = 'chaingraph/kernels/registry-lineage-records.json';
export const RECEIPT_BUNDLE_PREFIX = 'chaingraph/receipt-bundles/';
export const FILE_CAP = 100; // gh caps `--json files` at 100, so a full list may hide registry paths
export const SHARED_RESIDUAL = [
  'chaingraph/standard/clause-snapshot-registry.json',
  'scripts/compute-proof-baseline.json',
  'chaingraph/chaingraph.meta.json',
];
export const PARALLEL_MAX = 2;

// 'none' | 'mainside' | 'serial'
export function lineageKind(files) {
  if (!isLineageClass(files)) return 'none';
  if (files.length >= FILE_CAP) return 'serial';
  const writesRegistry = files.some((f) => f.startsWith('registry/') || f === LINEAGE_LOG_FILE || f.startsWith(RECEIPT_BUNDLE_PREFIX));
  return writesRegistry ? 'serial' : 'mainside';
}

// Files shared by two PRs, counting every SHARED_RESIDUAL file either one touches.
export function sharedFiles(a, b) {
  const bs = new Set(b);
  const shared = new Set(a.filter((f) => bs.has(f)));
  for (const f of [...a, ...b]) if (SHARED_RESIDUAL.includes(f)) shared.add(f);
  return [...shared];
}

// Slot rule for a mainside PR under ctx.lineageParallel. armed: [{number, files}] lineage-class PRs already labelled or
// queued. Returns a wait reason, or null when the PR may arm.
export function parallelSlotBlocker(pr, armed, max = PARALLEL_MAX) {
  const others = armed.filter((o) => o.number !== pr.number);
  const ser = others.find((o) => lineageKind(o.files) !== 'mainside');
  if (ser) return `another-lineage-pr-armed-or-queued:#${ser.number}`;
  if (others.length >= max) return `lineage-parallel-full:${others.length}/${max}`;
  for (const o of others) {
    const sh = sharedFiles(pr.files, o.files);
    if (sh.length) return `lineage-overlap-with:#${o.number}:${sh.slice(0, 3).join(',')}`;
  }
  return null;
}

// ── CO-ARM (LINEAGE-COARM-1, opt-in, off by default) ───────────────────────
// The mainside mode above never lets two "serial" PRs fly together. Measured
// 2026-11-25: all 11 waiting kernel PRs were serial only because each renames
// its OWN content-addressed record under registry/kernel/. Those records have
// no shared index (each is linked only from its own node page), and the
// lineage log, absence tree, receipt bundles and counts are main-only regen
// outputs, rebuilt on every push to main. Measured Nov 1-25: no kernel-vs-kernel semantic eject
// after 11-07; the ejects that did happen were PR-vs-main (stale proof links
// after a record rename, #3278; SPEC.md drift making every record stale,
// #2831) or a since-fixed ID-collision false positive (#2524). A textual merge
// test catches none of those, so co-arm needs an executed gate VERDICT on the
// exact combined tree (scripts/ci/coarm-gates.mjs), not just a clean merge.
//
// A second lineage PR may arm beside ONE armed/queued lineage PR only when ALL
// hold (any missing fact fails closed to the serial rule):
//   - both are co-arm eligible (coarmIneligible() === null): lineage-class,
//     under the 100-file list cap, registry writes are only
//     registry/kernel/<64 hex>.json records, no lineage log, no receipt
//     bundles, no SPEC.md or SHARED_RESIDUAL file, no new node file;
//   - at most COARM_MAX (2) lineage PRs armed/queued at once, matching the
//     queue's build width (max_entries_to_build 2): a third would only wait;
//   - file-disjoint (sharedFiles, residual files count as overlap);
//   - main's latest completed derived-artifacts-regen run is green (a stale
//     main is what feeds the #3278 class);
//   - no recent eject (no open PR carries mq-ejected and no merge_group run
//     failed inside COARM_EJECT_COOLDOWN_H): after any eject the lane falls
//     back to one at a time;
//   - a verdict with ok:true exists for exactly this set, bound to main's tip
//     and to each PR's head sha.
export const COARM_MAX = 2;
export const COARM_EJECT_COOLDOWN_H = 6;
export const SPEC_PATH = 'chaingraph/standard/SPEC.md';
export const NODE_PREFIX = 'chaingraph/graph/nodes/';
const KERNEL_RECORD = /^registry\/kernel\/[0-9a-f]{64}\.json$/;

// pr: {files, newNodePaths?}. newNodePaths are the PR's node files absent on
// main (the CLI fills it; undefined = unknown, which fails closed).
export function coarmIneligible(pr) {
  const files = pr.files || [];
  if (!isLineageClass(files)) return 'not-lineage-class';
  if (files.length >= FILE_CAP) return 'file-list-capped';
  const mainOnly = files.find((f) => f === LINEAGE_LOG_FILE || f.startsWith(RECEIPT_BUNDLE_PREFIX));
  if (mainOnly) return `main-only-path:${mainOnly}`;
  const reg = files.find((f) => f.startsWith('registry/') && !KERNEL_RECORD.test(f));
  if (reg) return `registry-path-not-a-kernel-record:${reg}`;
  const shared = files.find((f) => f === SPEC_PATH || SHARED_RESIDUAL.includes(f));
  if (shared) return `touches-shared-file:${shared}`;
  if (!Array.isArray(pr.newNodePaths)) return 'new-node-check-unknown';
  if (pr.newNodePaths.length) return `adds-node:${pr.newNodePaths[0]}`;
  return null;
}

// The verdict key: main tip + sorted "number:headSha" pairs.
export const coarmKey = (base, prs) => `${base}|${prs.map((p) => `${p.number}:${p.headSha}`).sort().join(',')}`;

// coarm: {regenGreen, recentEject, verdicts:[{base, prs:[{number, headSha}], ok}]}
// armed: [{number, files, headSha, newNodePaths}] lineage PRs labelled or queued.
// Returns {mode:'serial'} when co-arm does not apply (nothing armed: the
// baton decides as before), {block: reason}, or {mode:'coarm'}.
export function coarmDecision(pr, armed, coarm, mainTip) {
  const others = (armed || []).filter((o) => o.number !== pr.number);
  if (others.length === 0) return { mode: 'serial' };
  if (!coarm) return { block: 'another-lineage-pr-armed-or-queued' };
  if (coarm.regenGreen !== true) return { block: 'coarm-hold:main-regen-not-green' };
  if (coarm.recentEject !== false) return { block: 'coarm-hold:recent-eject' };
  if (others.length >= COARM_MAX) return { block: `coarm-full:${others.length}/${COARM_MAX}` };
  const mine = coarmIneligible(pr);
  if (mine) return { block: `coarm-ineligible:${mine}` };
  for (const o of others) {
    const why = coarmIneligible(o);
    if (why) return { block: `coarm-armed-pr-ineligible:#${o.number}:${why}` };
    const sh = sharedFiles(pr.files, o.files);
    if (sh.length) return { block: `coarm-overlap-with:#${o.number}:${sh.slice(0, 3).join(',')}` };
  }
  const set = [pr, ...others];
  if (set.some((p) => !p.headSha) || !mainTip) return { block: 'coarm-head-or-tip-unknown' };
  const want = coarmKey(mainTip, set);
  const v = (coarm.verdicts || []).find((x) => x && x.base && Array.isArray(x.prs) && coarmKey(x.base, x.prs) === want);
  if (!v) return { block: 'coarm-no-verdict-for-set' };
  if (v.ok !== true) return { block: 'coarm-verdict-red' };
  return { mode: 'coarm' };
}

// pr: {number, isDraft, labels:[names], files:[paths], branch, headSha?, newNodePaths?}
// checks: [{name, bucket}] for REQUIRED checks on the current head
// ctx: {allow:{prs,lineage}, mainTip, mergeFirstParent, openBranches:[...],
//       otherLineageArmed:boolean,
//       lineageParallel?: {max}      (opt-in parallel slots for mainside PRs; absent = one lineage PR at a time)
//       armedLineage?: [{number, files}]  (lineage-class PRs labelled or queued, for the parallel slot rule)
//       coarm?: {regenGreen, recentEject, verdicts}  (opt-in LINEAGE-COARM-1; absent = off)}
export function decide(pr, checks, ctx) {
  const wait = (reason) => ({ action: 'wait', reason });
  const row = ctx.allow.prs?.[pr.branch];
  if (!row) return { action: 'skip', reason: 'not-in-allowlist' };
  if (pr.labels.includes(LABEL)) return wait('already-labelled');
  if (pr.isDraft) return wait('draft');
  if (pr.labels.includes('hold')) return wait('hold-label');
  if (pr.files.some((f) => f.startsWith('.github/workflows/'))) {
    return wait('touches-.github/workflows');
  }
  const lineage = isLineageClass(pr.files);
  const parallel = lineage && ctx.lineageParallel && lineageKind(pr.files) === 'mainside';
  let coarmed = false;
  if (parallel) {
    // No baton for a mainside PR. Without an armed list, any armed lineage PR blocks (fail closed).
    if (!ctx.armedLineage && ctx.otherLineageArmed) return wait('another-lineage-pr-armed-or-queued');
    const why = parallelSlotBlocker(pr, ctx.armedLineage || [], ctx.lineageParallel.max ?? PARALLEL_MAX);
    if (why) return wait(why);
  } else if (lineage) {
    // Co-arm (opt-in): with exactly one other lineage PR armed and every
    // co-arm condition met, the baton passes to the next open branch in order.
    const cd = ctx.coarm ? coarmDecision(pr, ctx.armedLineage, ctx.coarm, ctx.mainTip) : { mode: 'serial' };
    if (cd.block) return wait(cd.block);
    coarmed = cd.mode === 'coarm';
    const armedBranches = new Set(coarmed ? (ctx.armedLineage || []).map((o) => o.branch) : []);
    const order = ctx.allow.lineage || [];
    const first = order.find((b) => ctx.openBranches.includes(b) && !armedBranches.has(b));
    if (first !== pr.branch) return wait(`lineage-baton-held-by:${first || 'unlisted'}`);
    if (!coarmed && ctx.otherLineageArmed) return wait('another-lineage-pr-armed-or-queued');
  }
  if (!checks.length) return wait('no-required-checks-reported');
  const bad = checks.filter((c) => !['pass', 'skipping'].includes(c.bucket));
  if (bad.length) {
    return wait(`required-checks-not-green:${bad.map((c) => `${c.name}=${c.bucket}`).join(',')}`);
  }
  if (!ctx.mergeFirstParent || ctx.mergeFirstParent !== ctx.mainTip) {
    return { action: 'update-branch', reason: 'merge-ref-first-parent-not-main-tip' };
  }
  const lane = parallel ? ' lineage-parallel' : coarmed ? ' lineage-coarm' : ' lineage';
  return { action: 'arm', reason: `green+fresh row=${row}${lineage ? lane : ''}` };
}

// --- CLI ---------------------------------------------------------------
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const ghJson = (args) => JSON.parse(gh(args));

// LINEAGE-COARM-1 facts. regenGreen: main's latest completed derived-artifacts-regen run succeeded.
// recentEject: an open PR carries mq-ejected, or a merge_group run failed in the cooldown window.
// verdicts: the JSON array that scripts/ci/coarm-gates.mjs wrote, at $AUTO_ARM_COARM_VERDICTS (absent = none).
export function readCoarmFacts(repo, info, now = Date.now()) {
  let regenGreen = null;
  try {
    const r = ghJson(['api', `repos/${repo}/actions/workflows/derived-artifacts-regen.yml/runs?branch=main&status=completed&per_page=1`]);
    regenGreen = r.workflow_runs?.[0]?.conclusion === 'success';
  } catch { regenGreen = null; }
  let recentEject = null;
  try {
    if (info.some((p) => p.labels.includes('mq-ejected'))) recentEject = true;
    else {
      const since = new Date(now - COARM_EJECT_COOLDOWN_H * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
      const r = ghJson(['api', `repos/${repo}/actions/runs?event=merge_group&status=failure&created=%3E%3D${since}&per_page=1`]);
      recentEject = (r.total_count || 0) > 0;
    }
  } catch { recentEject = null; }
  let verdicts = [];
  const vp = process.env.AUTO_ARM_COARM_VERDICTS;
  if (vp) {
    try { verdicts = JSON.parse(readFileSync(vp, 'utf8')); } catch { verdicts = []; }
    if (!Array.isArray(verdicts)) verdicts = [];
  }
  return { regenGreen, recentEject, verdicts };
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const ri = argv.indexOf('--repo');
  const repo = ri >= 0 ? argv[ri + 1] : process.env.GITHUB_REPOSITORY || 'PostOakLabs/ainumbers';
  const here = dirname(fileURLToPath(import.meta.url));
  const allow = JSON.parse(readFileSync(resolve(here, 'auto-arm-allow.json'), 'utf8'));

  const prs = ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '200', '--json',
    'number,headRefName,headRefOid,isDraft,labels,files,headRepositoryOwner']);
  const mainTip = ghJson(['api', `repos/${repo}/commits/main`]).sha;
  const info = prs.map((p) => ({
    number: p.number, branch: p.headRefName, isDraft: p.isDraft,
    labels: p.labels.map((l) => l.name), files: p.files.map((f) => f.path), headSha: p.headRefOid,
    // Node files the PR carries that main's checkout (this job runs on main) does not have.
    newNodePaths: p.files.map((f) => f.path).filter((f) => f.startsWith(NODE_PREFIX) && !existsSync(resolve(here, '../..', f))),
  }));
  const queued = (n) => {
    const id = ghJson(['pr', 'view', String(n), '-R', repo, '--json', 'id']).id;
    return ghJson(['api', 'graphql', '-f', `query=query($id:ID!){node(id:$id){... on PullRequest{mergeQueueEntry{id}}}}`,
      '-f', `id=${id}`]).data.node.mergeQueueEntry !== null;
  };
  const openBranches = info.map((p) => p.branch);
  // Parallel mainside slots are opt-in: the workflow sets AUTO_ARM_LINEAGE_PARALLEL=1 only when the operator turns
  // them on. Unset (today's workflow) keeps one lineage PR at a time.
  const lineageParallel = process.env.AUTO_ARM_LINEAGE_PARALLEL === '1' ? { max: PARALLEL_MAX } : null;
  // Co-arm is opt-in too (AUTO_ARM_LINEAGE_COARM=1). Its facts are read once per run; any read failure leaves
  // a fact unknown, and decide() treats unknown as "hold" (serial).
  const coarm = process.env.AUTO_ARM_LINEAGE_COARM === '1' ? readCoarmFacts(repo, info) : null;
  let failed = 0;
  const lines = [];
  for (const pr of info) {
    let d;
    try {
      const inAllow = !!allow.prs?.[pr.branch];
      let checks = [];
      let mergeFirstParent = null;
      let otherLineageArmed = false;
      let armedLineage = [];
      if (inAllow) {
        try {
          checks = ghJson(['pr', 'checks', String(pr.number), '-R', repo, '--required', '--json', 'name,bucket']);
        } catch (e) {
          // gh exits non-zero when checks are failing/pending but still prints JSON.
          try { checks = JSON.parse(String(e.stdout || '[]')); } catch { checks = []; }
        }
        try {
          const ref = ghJson(['api', `repos/${repo}/git/ref/pull/${pr.number}/merge`]).object.sha;
          mergeFirstParent = ghJson(['api', `repos/${repo}/git/commits/${ref}`]).parents[0]?.sha || null;
        } catch { mergeFirstParent = null; }
        armedLineage = info.filter((o) => o.number !== pr.number && isLineageClass(o.files)
          && (o.labels.includes(LABEL) || queued(o.number))).map((o) => ({
          number: o.number, files: o.files, branch: o.branch, headSha: o.headSha, newNodePaths: o.newNodePaths,
        }));
        otherLineageArmed = armedLineage.length > 0;
      }
      d = decide(pr, checks, { allow, mainTip, mergeFirstParent, openBranches, otherLineageArmed, armedLineage, lineageParallel, coarm });
      if (!dry && d.action === 'arm') gh(['pr', 'edit', String(pr.number), '-R', repo, '--add-label', LABEL]);
      if (!dry && d.action === 'update-branch') {
        gh(['api', '-X', 'PUT', `repos/${repo}/pulls/${pr.number}/update-branch`]);
      }
    } catch (e) {
      d = { action: 'error', reason: String(e.message).split('\n')[0] };
      failed++;
    }
    const verb = d.action === 'arm' ? 'armed' : d.action === 'update-branch' ? 'updated-branch' : 'waiting';
    lines.push(`#${pr.number} ${pr.branch} | ${dry ? 'DRY ' : ''}${d.action === 'skip' ? 'skip' : verb}: ${d.reason}`);
  }
  const out = lines.join('\n');
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) {
    execFileSync(process.execPath, ['-e',
      `require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### auto-arm\\n\\n'+process.argv[1]+'\\n')`, out]);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
