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
// Never removes labels, never merges, never touches non-allowlisted PRs.
//
// Usage: node scripts/ci/auto-arm.mjs [--dry-run] [--repo OWNER/NAME]
//   --dry-run  print the decision per open PR, change nothing.

import { readFileSync } from 'node:fs';
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

// pr: {number, isDraft, labels:[names], files:[paths], branch}
// checks: [{name, bucket}] for REQUIRED checks on the current head
// ctx: {allow:{prs,lineage}, mainTip, mergeFirstParent, openBranches:[...],
//       otherLineageArmed:boolean}
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
  if (lineage) {
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
  return { action: 'arm', reason: `green+fresh row=${row}${lineage ? ' lineage' : ''}` };
}

// --- CLI ---------------------------------------------------------------
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const ghJson = (args) => JSON.parse(gh(args));

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const ri = argv.indexOf('--repo');
  const repo = ri >= 0 ? argv[ri + 1] : process.env.GITHUB_REPOSITORY || 'PostOakLabs/ainumbers';
  const here = dirname(fileURLToPath(import.meta.url));
  const allow = JSON.parse(readFileSync(resolve(here, 'auto-arm-allow.json'), 'utf8'));

  const prs = ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '200', '--json',
    'number,headRefName,isDraft,labels,files,headRepositoryOwner']);
  const mainTip = ghJson(['api', `repos/${repo}/commits/main`]).sha;
  const info = prs.map((p) => ({
    number: p.number, branch: p.headRefName, isDraft: p.isDraft,
    labels: p.labels.map((l) => l.name), files: p.files.map((f) => f.path),
  }));
  const queued = (n) => {
    const id = ghJson(['pr', 'view', String(n), '-R', repo, '--json', 'id']).id;
    return ghJson(['api', 'graphql', '-f', `query=query($id:ID!){node(id:$id){... on PullRequest{mergeQueueEntry{id}}}}`,
      '-f', `id=${id}`]).data.node.mergeQueueEntry !== null;
  };
  const openBranches = info.map((p) => p.branch);
  let failed = 0;
  const lines = [];
  for (const pr of info) {
    let d;
    try {
      const inAllow = !!allow.prs?.[pr.branch];
      let checks = [];
      let mergeFirstParent = null;
      let otherLineageArmed = false;
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
        otherLineageArmed = info.some((o) => o.number !== pr.number && isLineageClass(o.files)
          && (o.labels.includes(LABEL) || queued(o.number)));
      }
      d = decide(pr, checks, { allow, mainTip, mergeFirstParent, openBranches, otherLineageArmed });
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
