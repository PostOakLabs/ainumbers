#!/usr/bin/env node
// auto-arm.mjs — AUTO-ARM-ON-GREEN-1. Mechanises ORCH's arm rule: ONE
// `automerge` label on a PR that is green on its CURRENT head, whose merge ref
// has main's tip as first parent (CURE-SEQUENCE-1, ORCH-AUTOBOOT-PROMPT.md;
// V655: "update-branch, confirm a fresh merge ref, fresh green, ONE automerge
// label"; V658 serial lane: lineage PRs one at a time).
//
// The decision is a PURE function so every condition is fixture-testable
// (auto-arm.test.mjs). The CLI wraps it with `gh` calls.
//
// CLI ELIGIBILITY (AUTO-ARM-LABEL-ELIGIBILITY-1): the CLI runs
// decideLabeled(). A PR is eligible when it carries the `auto-arm` label, not
// when its branch is listed in a committed allowlist file. See "Label
// eligibility" below. The allowlist-based decide() and its parallel-slot
// helpers stay exported and tested as the reference for the earlier rules;
// the CLI no longer calls decide().
//
// decide() (legacy allowlist rules) labels a PR ONLY when ALL hold:
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
// Never removes labels, never merges, never touches non-allowlisted PRs.
//
// Usage: node scripts/ci/auto-arm.mjs [--dry-run] [--repo OWNER/NAME]
//   --dry-run  print the decision per open PR, change nothing.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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

// pr: {number, isDraft, labels:[names], files:[paths], branch}
// checks: [{name, bucket}] for REQUIRED checks on the current head
// ctx: {allow:{prs,lineage}, mainTip, mergeFirstParent, openBranches:[...],
//       otherLineageArmed:boolean,
//       lineageParallel?: {max}      (opt-in parallel slots for mainside PRs; absent = one lineage PR at a time)
//       armedLineage?: [{number, files}]  (lineage-class PRs labelled or queued, for the parallel slot rule)}
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
  if (parallel) {
    // No baton for a mainside PR. Without an armed list, any armed lineage PR blocks (fail closed).
    if (!ctx.armedLineage && ctx.otherLineageArmed) return wait('another-lineage-pr-armed-or-queued');
    const why = parallelSlotBlocker(pr, ctx.armedLineage || [], ctx.lineageParallel.max ?? PARALLEL_MAX);
    if (why) return wait(why);
  } else if (lineage) {
    const order = ctx.allow.lineage || [];
    const first = order.find((b) => ctx.openBranches.includes(b));
    if (first !== pr.branch) return wait(`lineage-baton-held-by:${first || 'unlisted'}`);
    if (ctx.otherLineageArmed) return wait('another-lineage-pr-armed-or-queued');
  }
  if (!checks.length) return wait('no-required-checks-reported');
  const bad = checks.filter((c) => !['pass', 'skipping'].includes(c.bucket));
  if (bad.length) {
    return wait(`required-checks-not-green:${bad.map((c) => `${c.name}=${c.bucket}`).join(',')}`);
  }
  if (!ctx.mergeFirstParent || ctx.mergeFirstParent !== ctx.mainTip) {
    return { action: 'update-branch', reason: 'merge-ref-first-parent-not-main-tip' };
  }
  return { action: 'arm', reason: `green+fresh row=${row}${lineage ? (parallel ? ' lineage-parallel' : ' lineage') : ''}` };
}

// --- Label eligibility (AUTO-ARM-LABEL-ELIGIBILITY-1) ---------------------
// Eligibility comes from a label on the PR instead of a branch entry in a
// committed file, so opting a PR in needs no repo commit and no second PR.
// Rules mirror the cloud arming sweep:
//   1. only PRs carrying ELIGIBLE_LABEL are considered; everything else skips;
//   2. oldest first (ascending PR number);
//   3. head-of-line for kernel (lineage-class) PRs: the oldest eligible
//      lineage PR whose required checks are not red is the head; it keeps the
//      head (younger lineage PRs wait behind it) until it is armed or turns red;
//   4. no two lineage PRs sharing files: a lineage PR waits while any armed or
//      queued lineage PR shares a file with it (SHARED_RESIDUAL counts as
//      shared whenever either PR touches one).
// Non-lineage PRs are not held by the head; each arms when green and fresh.
export const ELIGIBLE_LABEL = 'auto-arm';

export const isRed = (checks) => checks.some((c) => ['fail', 'cancel'].includes(c.bucket));
const isGreen = (checks) => checks.length > 0 && checks.every((c) => ['pass', 'skipping'].includes(c.bucket));

// Pick the lineage head. prs: [{number, isDraft, labels, files}] (any order);
// checksOf: number -> required checks. Returns a PR number or null.
export function pickLineageHead(prs, checksOf, queuedSet = new Set()) {
  const cands = prs
    .filter((p) => p.labels.includes(ELIGIBLE_LABEL) && isLineageClass(p.files))
    .filter((p) => !p.isDraft && !p.labels.includes('hold'))
    .filter((p) => !p.labels.includes(LABEL) && !queuedSet.has(p.number))
    .sort((a, b) => a.number - b.number);
  const head = cands.find((p) => !isRed(checksOf(p.number) || []));
  return head ? head.number : null;
}

// ctx: {mainTip, mergeFirstParent, lineageHead:number|null, armedLineage:[{number, files}]}
export function decideLabeled(pr, checks, ctx) {
  const wait = (reason) => ({ action: 'wait', reason });
  if (!pr.labels.includes(ELIGIBLE_LABEL)) return { action: 'skip', reason: `no-${ELIGIBLE_LABEL}-label` };
  if (pr.labels.includes(LABEL)) return wait('already-labelled');
  if (pr.isDraft) return wait('draft');
  if (pr.labels.includes('hold')) return wait('hold-label');
  if (pr.files.some((f) => f.startsWith('.github/workflows/'))) return wait('touches-.github/workflows');
  const lineage = isLineageClass(pr.files);
  if (lineage) {
    if (ctx.lineageHead !== pr.number) return wait(`lineage-head-is:#${ctx.lineageHead ?? 'none'}`);
    for (const o of (ctx.armedLineage || []).filter((x) => x.number !== pr.number)) {
      const sh = sharedFiles(pr.files, o.files);
      if (sh.length) return wait(`lineage-overlap-with:#${o.number}:${sh.slice(0, 3).join(',')}`);
    }
  }
  if (!checks.length) return wait('no-required-checks-reported');
  if (!isGreen(checks)) {
    const bad = checks.filter((c) => !['pass', 'skipping'].includes(c.bucket));
    return wait(`required-checks-not-green:${bad.map((c) => `${c.name}=${c.bucket}`).join(',')}`);
  }
  if (!ctx.mergeFirstParent || ctx.mergeFirstParent !== ctx.mainTip) {
    return { action: 'update-branch', reason: 'merge-ref-first-parent-not-main-tip' };
  }
  return { action: 'arm', reason: `green+fresh label=${ELIGIBLE_LABEL}${lineage ? ' lineage-head' : ''}` };
}

// --- CLI ---------------------------------------------------------------
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const ghJson = (args) => JSON.parse(gh(args));

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const ri = argv.indexOf('--repo');
  const repo = ri >= 0 ? argv[ri + 1] : process.env.GITHUB_REPOSITORY || 'PostOakLabs/ainumbers';
  const prs = ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '200', '--json',
    'number,headRefName,isDraft,labels,files,headRepositoryOwner']);
  const mainTip = ghJson(['api', `repos/${repo}/commits/main`]).sha;
  // Oldest first: the sweep's ordering rule.
  const info = prs.map((p) => ({
    number: p.number, branch: p.headRefName, isDraft: p.isDraft,
    labels: p.labels.map((l) => l.name), files: p.files.map((f) => f.path),
  })).sort((a, b) => a.number - b.number);
  const queued = (n) => {
    const id = ghJson(['pr', 'view', String(n), '-R', repo, '--json', 'id']).id;
    return ghJson(['api', 'graphql', '-f', `query=query($id:ID!){node(id:$id){... on PullRequest{mergeQueueEntry{id}}}}`,
      '-f', `id=${id}`]).data.node.mergeQueueEntry !== null;
  };
  const requiredChecks = (n) => {
    try {
      return ghJson(['pr', 'checks', String(n), '-R', repo, '--required', '--json', 'name,bucket']);
    } catch (e) {
      // gh exits non-zero when checks are failing/pending but still prints JSON.
      try { return JSON.parse(String(e.stdout || '[]')); } catch { return []; }
    }
  };
  const eligible = info.filter((p) => p.labels.includes(ELIGIBLE_LABEL));
  const checksByPr = new Map(eligible.map((p) => [p.number, requiredChecks(p.number)]));
  // Lineage PRs already armed (label) or sitting in the merge queue, for the file-overlap rule.
  const queuedSet = new Set(info.filter((o) => isLineageClass(o.files) && !o.labels.includes(LABEL) && queued(o.number))
    .map((o) => o.number));
  const armedLineage = info.filter((o) => isLineageClass(o.files) && (o.labels.includes(LABEL) || queuedSet.has(o.number)))
    .map((o) => ({ number: o.number, files: o.files }));
  const lineageHead = pickLineageHead(info, (n) => checksByPr.get(n), queuedSet);
  let failed = 0;
  const lines = [`lineage head: ${lineageHead ? `#${lineageHead}` : 'none'}; ${eligible.length} PR(s) carry ${ELIGIBLE_LABEL}`];
  for (const pr of eligible) {
    let d;
    try {
      let mergeFirstParent = null;
      try {
        const ref = ghJson(['api', `repos/${repo}/git/ref/pull/${pr.number}/merge`]).object.sha;
        mergeFirstParent = ghJson(['api', `repos/${repo}/git/commits/${ref}`]).parents[0]?.sha || null;
      } catch { mergeFirstParent = null; }
      d = decideLabeled(pr, checksByPr.get(pr.number) || [], { mainTip, mergeFirstParent, lineageHead, armedLineage });
      if (!dry && d.action === 'arm') gh(['pr', 'edit', String(pr.number), '-R', repo, '--add-label', LABEL]);
      if (!dry && d.action === 'update-branch') {
        gh(['api', '-X', 'PUT', `repos/${repo}/pulls/${pr.number}/update-branch`]);
      }
    } catch (e) {
      d = { action: 'error', reason: String(e.message).split('\n')[0] };
      failed++;
    }
    const verb = d.action === 'arm' ? 'armed' : d.action === 'update-branch' ? 'updated-branch' : 'waiting';
    lines.push(`#${pr.number} ${pr.branch} | ${dry ? 'DRY ' : ''}${verb}: ${d.reason}`);
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
