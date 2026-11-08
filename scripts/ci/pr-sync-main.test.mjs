#!/usr/bin/env node
/**
 * scripts/ci/pr-sync-main.test.mjs — fixture proof for the decision half of
 * scripts/ci/pr-sync-main.mjs (PR-AUTOFIX-MAIN-MOVED-1).
 *
 * What it proves:
 *   1. decide(): every row class the brief names — behind/clean, dirty in
 *      main-owned paths only, dirty-real, fork, draft, `no-bot-sync` label —
 *      plus the loop/race guards: merge queue, fresh head, attempt cap, and
 *      one real-conflict comment per head.
 *   2. mainOwnedPaths() over a synthetic COVERED: whole-file artifacts in,
 *      per-PR page patchers out, broad report prefixes out, narrow report
 *      prefixes in as prefixes, counts .html pages out (sentinel class).
 *   3. The live SSOT: RESERVATIONS.json, kernels, node shards, node pages and
 *      manifests are never main-owned; mcp/catalog.json, chaingraph.json,
 *      sitemap.xml and .well-known/trust-signals.json are.
 *   4. isSentinelOnlyDiff(): a count-value-only diff is true; any prose change,
 *      an added line, or an empty diff is false.
 *   5. parseMergeTree() against REAL `git merge-tree --write-tree` output from a
 *      throwaway repo (clean merge and a two-path conflict).
 *   6. syncOne() end to end against a local bare remote: a derived-only
 *      conflict is merged (main's side of the derived path, the PR's own
 *      files kept) and pushed; a real conflict pushes nothing; a branch that
 *      moved mid-run rejects the plain push and is flagged as a race. The
 *      legacy id registry: a PR that only added ids gets main's frozen
 *      RESERVATIONS.json plus one shard per added id (one id, two ids); a
 *      same-id shard on main with other content is refused; main's own
 *      check-id-collision --seed-check runs on the merged tree and a failing
 *      seed-check pushes nothing.
 *   7. planReservations() + decide(): adds, collisions (shard and legacy),
 *      removed/re-pointed ids refused; registry + a real conflict stays real.
 *   8. regenGate(): a push:main run waits for the regen on its sha and still
 *      syncs when that regen committed nothing (the run on the regen bot's
 *      own commit); hands off when the regen committed; a timeout or a regen
 *      that never registers still syncs, so the job cannot strand itself.
 *   9. the red-head skip exceptions: every failing step on the head's latest
 *      required run a main-owned freshness step (MAIN_OWNED_FRESHNESS_STEPS,
 *      exact names) or the head's run started before main's latest recovery
 *      from a Scripts Verify red episode, and the skip lifts; a PR-owned
 *      failing step, one unlisted step among listed ones, a run newer than
 *      the recovery, or missing CI facts keep the skip.
 * Run: node scripts/ci/pr-sync-main.test.mjs   (exit 0 = all green)
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decide, mainOwnedPaths, sentinelOwnedPaths, isSentinelOnlyDiff, parseMergeTree, syncOne,
  waitForRegen, regenGate, planReservations, shardBytes, RESERVATIONS_LEGACY, SKIP_LABEL, MAX_ATTEMPTS_PER_HEAD, SYNC_ANYWAY_LABEL,
  MAIN_OWNED_FRESHNESS_STEPS,
} from './pr-sync-main.mjs';
import { gitEnv } from '../_git-env-lib.mjs';

// Every git spawn scrubs the ambient GIT_* env (GIT-ENV-LEAK-SWEEP-1): under
// the pre-push hook those would point at the outer repository, not the fixture.
const G = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv(), ...opts });

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`); }
}

const NOW = Date.parse('2026-11-03T12:00:00Z');
const OLD = '2026-11-03T10:00:00Z';
const RECOVERED = Date.parse('2026-11-03T11:00:00Z');
// A main-owned freshness step (listed) and a PR-owned one (never listed):
// the exact workflow step names the I/O half would report.
const FRESH_STEP = 'Derived-freshness, index-sync, sitemap (HARD on merge_group)';
const FRESH_STEP_2 = 'chaingraph.json shard freshness (CGSHARD-1 CS-1)';
const PR_STEP = 'Node page accessibility tree (HARD on pull_request — per-PR derivables promotion)';
const pr = (over = {}) => ({
  number: 1, isDraft: false, isCrossRepository: false, baseRefName: 'main', headRefName: 'feat-x',
  labels: [], inMergeQueue: false, headCommittedAt: OLD, ...over,
});
const OWNED = new Set(['mcp/catalog.json', 'sitemap.xml']);
const run = (over) => decide({ behind: true, conflicts: [], mainOwned: OWNED, now: NOW, ...over, pr: pr(over.pr) });

console.log('1. decide()');
t('behind, merges clean → merge-clean', () => {
  const d = run({ behind: true, conflicts: [] });
  assert.equal(d.action, 'merge-clean');
});
t('dirty only in main-owned derived paths → merge-derived with those paths', () => {
  const d = run({ conflicts: ['mcp/catalog.json', 'sitemap.xml'] });
  assert.equal(d.action, 'merge-derived');
  assert.deepEqual(d.paths, ['mcp/catalog.json', 'sitemap.xml']);
});
t('dirty in a real path (even alongside derived ones) → conflict-real naming only the real paths, notify', () => {
  const d = run({ conflicts: ['mcp/catalog.json', 'chaingraph/graph/RESERVATIONS.json'] });
  assert.equal(d.action, 'conflict-real');
  assert.deepEqual(d.paths, ['chaingraph/graph/RESERVATIONS.json']);
  assert.equal(d.notify, true);
});
t('real conflict already commented for this head → still conflict-real, notify false', () => {
  const d = run({ conflicts: ['scripts/x.mjs'], notified: true });
  assert.equal(d.action, 'conflict-real');
  assert.equal(d.notify, false);
});
t('sentinel-eligible page counts as resolvable only when listed in sentinelOk', () => {
  assert.equal(run({ conflicts: ['about.html'] }).action, 'conflict-real');
  assert.equal(run({ conflicts: ['about.html'], sentinelOk: new Set(['about.html']) }).action, 'merge-derived');
});
t('fork → skip fork (even when dirty)', () => {
  assert.deepEqual(run({ pr: { isCrossRepository: true }, conflicts: ['x'] }), { action: 'skip', reason: 'fork', paths: [] });
});
t('draft → skip draft', () => {
  assert.equal(run({ pr: { isDraft: true } }).reason, 'draft');
});
t(`labelled ${SKIP_LABEL} → skip label`, () => {
  assert.equal(run({ pr: { labels: ['automerge', SKIP_LABEL] } }).reason, `label:${SKIP_LABEL}`);
});
t('in the merge queue → skip (a push would eject it)', () => {
  assert.equal(run({ pr: { inMergeQueue: true } }).reason, 'in-merge-queue');
});
t('head already contains main → skip current', () => {
  assert.equal(run({ behind: false, conflicts: [] }).reason, 'current');
});
t('merge prediction failed (null) → skip merge-unknown, never acts blind', () => {
  assert.equal(run({ conflicts: null }).reason, 'merge-unknown');
});
t('base not main → skip', () => {
  assert.equal(run({ pr: { baseRefName: 'release' } }).reason, 'base-not-main');
});
t(`attempt cap: ${MAX_ATTEMPTS_PER_HEAD} failed attempts on this head → skip; one fewer → acts`, () => {
  assert.equal(run({ attempts: MAX_ATTEMPTS_PER_HEAD }).reason, `attempts:${MAX_ATTEMPTS_PER_HEAD}`);
  assert.equal(run({ attempts: MAX_ATTEMPTS_PER_HEAD - 1 }).action, 'merge-clean');
});
t('fresh head (builder may still be pushing) → skip; same head past the window → acts', () => {
  assert.equal(run({ pr: { headCommittedAt: '2026-11-03T11:55:00Z' } }).reason, 'fresh-head');
  assert.equal(run({ pr: { headCommittedAt: '2026-11-03T11:55:00Z' }, minHeadAgeMs: 60_000 }).action, 'merge-clean');
});
t('CI pending on a recent head → skip checks-running; pending past the window or SUCCESS → acts', () => {
  assert.equal(run({ pr: { checksState: 'PENDING', headCommittedAt: '2026-11-03T11:30:00Z' } }).reason, 'checks-running');
  assert.equal(run({ pr: { checksState: 'PENDING', headCommittedAt: OLD } }).action, 'merge-clean');
  assert.equal(run({ pr: { checksState: 'SUCCESS', headCommittedAt: '2026-11-03T11:30:00Z' } }).action, 'merge-clean');
});
t('armed + BEHIND clean → skip (queue rebuilds); armed + derived-DIRTY still acts (queue cannot take a conflict)', () => {
  assert.equal(run({ pr: { labels: ['automerge'] } }).reason, 'armed-queue-rebuilds');
  assert.equal(run({ pr: { labels: ['automerge'] }, conflicts: ['mcp/catalog.json'] }).action, 'merge-derived');
});
t('red head, clean BEHIND, main touched nothing the PR touches → skip red-head-no-shared-files', () => {
  for (const checksState of ['FAILURE', 'ERROR']) {
    assert.equal(run({ pr: { checksState }, sharedFiles: [] }).reason, 'red-head-no-shared-files');
  }
});
t('red + CONFLICTING (derived-dirty or real) → still syncs / reports as before', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, conflicts: ['mcp/catalog.json'], sharedFiles: [] }).action, 'merge-derived');
  assert.equal(run({ pr: { checksState: 'FAILURE' }, conflicts: ['scripts/x.mjs'], sharedFiles: [] }).action, 'conflict-real');
});
t('red + main touched a file the PR also touches → syncs', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: ['scripts/x.mjs'] }).action, 'merge-clean');
});
t(`red + ${SYNC_ANYWAY_LABEL} label → syncs`, () => {
  assert.equal(run({ pr: { checksState: 'FAILURE', labels: [SYNC_ANYWAY_LABEL] }, sharedFiles: [] }).action, 'merge-clean');
});
t('red + overlap unknown (null/undefined) → syncs, never skips blind', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: null }).action, 'merge-clean');
  assert.equal(run({ pr: { checksState: 'FAILURE' } }).action, 'merge-clean');
});
t('green / pending-past-window / no rollup → unchanged behaviour even with no shared files', () => {
  for (const checksState of ['SUCCESS', 'PENDING', null]) {
    assert.equal(run({ pr: { checksState }, sharedFiles: [] }).action, 'merge-clean');
  }
});
t('red + only a main-owned freshness step failing → syncs (a merge of main repairs it)', () => {
  for (const step of MAIN_OWNED_FRESHNESS_STEPS) {
    assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [step] }).action, 'merge-clean');
  }
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [FRESH_STEP, FRESH_STEP_2] }).action, 'merge-clean');
});
t('red + freshness steps with no recovery data → still syncs on the freshness exception alone', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [FRESH_STEP], mainRecoveredAt: null, headRunStartedAt: null }).action, 'merge-clean');
});
t('red + a PR-owned failing step → still skip red-head-no-shared-files', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [PR_STEP] }).reason, 'red-head-no-shared-files');
});
t('red + mixed failing steps (one unlisted) → still skip (exact names only, no prefix match)', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [FRESH_STEP, PR_STEP] }).reason, 'red-head-no-shared-files');
});
t('red + no failing steps read (runs green elsewhere) → still skip', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [] }).reason, 'red-head-no-shared-files');
});
t('red + head run started after (or exactly at) main recovery → still skip (the red is not stale)', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [PR_STEP], mainRecoveredAt: RECOVERED, headRunStartedAt: RECOVERED + 1 }).reason, 'red-head-no-shared-files');
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [PR_STEP], mainRecoveredAt: RECOVERED, headRunStartedAt: RECOVERED }).reason, 'red-head-no-shared-files');
});
t('red + missing CI facts (null/undefined) → still skip, never acts blind', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: null }).reason, 'red-head-no-shared-files');
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: undefined, mainRecoveredAt: null, headRunStartedAt: null }).reason, 'red-head-no-shared-files');
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: null, mainRecoveredAt: RECOVERED }).reason, 'red-head-no-shared-files');
});
t('red + head run started before main recovery → syncs (stale red, main has moved on)', () => {
  assert.equal(run({ pr: { checksState: 'FAILURE' }, sharedFiles: [], failingSteps: [PR_STEP], mainRecoveredAt: RECOVERED, headRunStartedAt: RECOVERED - 1 }).action, 'merge-clean');
});
t('red draft is never synced', () => {
  assert.equal(run({ pr: { isDraft: true, checksState: 'FAILURE' }, sharedFiles: ['a'] }).reason, 'draft');
});
t('guard order: a draft fork is reported as fork (the cheapest, unconditional skip first)', () => {
  assert.equal(run({ pr: { isDraft: true, isCrossRepository: true } }).reason, 'fork');
});

console.log('2. mainOwnedPaths() over a synthetic COVERED');
const SYN = [
  { id: 'catalog', artifacts: ['mcp/catalog.json', 'index.html'] },
  { id: 'node-page-footers', artifacts: ['chaingraph/art-1-x.html', 'index.html'] },
  { id: 'hub-scenes', artifacts: ['guides/a-hub.html'] },
  { id: 'counts', artifacts: ['about.html', '.well-known/mcp/server-card.json', 'guides/a-hub.html', 'index.html'] },
  { id: 'page-md-twins', artifacts: ['tools', 'chaingraph'], writesReport: 'r1' },
  { id: 'manifest-examples', artifacts: ['manifests/'], writesReport: 'r2' },
  { id: 'receipt-bundles', artifacts: ['chaingraph/receipt-bundles'], writesReport: 'r3' },
];
const syn = mainOwnedPaths(SYN);
t('whole-file artifact in; also declared by a patcher still in', () => {
  assert.ok(syn.has('mcp/catalog.json'));
  assert.ok(syn.has('index.html'));
});
t('per-PR page patcher pages out', () => {
  assert.ok(!syn.has('chaingraph/art-1-x.html'));
  assert.ok(!syn.has('guides/a-hub.html'));
});
t('broad report prefixes (tools, chaingraph, manifests/) never swallow PR files', () => {
  assert.ok(!syn.has('tools/1-x.html'));
  assert.ok(!syn.has('chaingraph/graph/nodes/art-1.json'));
  assert.ok(!syn.has('manifests/art-1.manifest.json'));
});
t('narrow report prefix in, as a prefix (not a substring)', () => {
  assert.ok(syn.has('chaingraph/receipt-bundles/art-1.bundle.json'));
  assert.ok(syn.has('chaingraph/receipt-bundles'));
  assert.ok(!syn.has('chaingraph/receipt-bundles-extra.json'));
});
t('counts: .html pages out of the outright set, machine files in', () => {
  assert.ok(!syn.has('about.html'));
  assert.ok(syn.has('.well-known/mcp/server-card.json'));
});
t('sentinelOwnedPaths: counts .html pages not otherwise owned (hub pages included)', () => {
  assert.deepEqual([...sentinelOwnedPaths(SYN)].sort(), ['about.html', 'guides/a-hub.html']);
});

console.log('3. live SSOT (scripts/derived-artifacts.mjs)');
const live = mainOwnedPaths();
for (const p of ['mcp/catalog.json', 'chaingraph/chaingraph.json', 'sitemap.xml', '.well-known/trust-signals.json', 'chaingraph/data/chain-builder-catalog.gen.js', 'scripts/compute-proof-baseline.json']) {
  t(`main-owned: ${p}`, () => assert.ok(live.has(p)));
}
for (const p of ['chaingraph/graph/RESERVATIONS.json', 'chaingraph/kernels/art-01.mjs', 'chaingraph/graph/nodes/art-01-ap2-mandate-chain-validator.json', 'chaingraph/art-01-ap2-mandate-chain-validator.html', 'manifests/art-01-ap2-mandate-chain-validator.manifest.json', 'chaingraph/chains/2052a-classify-daily.html', 'tools/152-baas-provider-comparator.html', 'scripts/a11y-baseline.json', '.github/workflows/pr-autofix.yml']) {
  t(`never main-owned: ${p}`, () => assert.ok(!live.has(p)));
}

console.log('4. isSentinelOnlyDiff()');
const hdr = 'diff --git a/x.html b/x.html\n--- a/x.html\n+++ b/x.html\n@@ -3 +3 @@\n';
t('count values only → true', () => {
  assert.equal(isSentinelOnlyDiff(hdr + '-Of <!--COUNT:zk.total-->684<!--/COUNT--> nodes, <span data-count="tools">12</span>\n+Of <!--COUNT:zk.total-->685<!--/COUNT--> nodes, <span data-count="tools">13</span>\n'), true);
});
t('a prose word changed on the same line → false', () => {
  assert.equal(isSentinelOnlyDiff(hdr + '-Of <!--COUNT:zk.total-->684<!--/COUNT--> nodes\n+Of <!--COUNT:zk.total-->685<!--/COUNT--> live nodes\n'), false);
});
t('a sentinel KEY changed → false (only values are main\'s)', () => {
  assert.equal(isSentinelOnlyDiff(hdr + '-<!--COUNT:a-->1<!--/COUNT-->\n+<!--COUNT:b-->1<!--/COUNT-->\n'), false);
});
t('an added line → false', () => {
  assert.equal(isSentinelOnlyDiff(hdr + '+<p>new paragraph</p>\n'), false);
});
t('empty diff → false', () => {
  assert.equal(isSentinelOnlyDiff(''), false);
});

console.log('5. parseMergeTree() on real git output');
const dir = mkdtempSync(join(tmpdir(), 'pr-sync-main-test-'));
const g = (...a) => G(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false', ...a], { cwd: dir });
const mergeTree = (a, b) => { try { return { status: 0, out: g('merge-tree', '--write-tree', '--name-only', '--no-messages', a, b) }; } catch (e) { return { status: e.status, out: String(e.stdout) }; } };
try {
  g('init', '-q');
  writeFileSync(join(dir, 'a.json'), '1\n'); writeFileSync(join(dir, 'b.txt'), 'x\n'); writeFileSync(join(dir, 'c.txt'), 'c\n');
  g('add', '.'); g('commit', '-qm', 'base');
  g('checkout', '-qb', 'pr');
  writeFileSync(join(dir, 'a.json'), '2\n'); writeFileSync(join(dir, 'b.txt'), 'pr\n'); g('commit', '-qam', 'pr');
  g('checkout', '-qb', 'pr-clean', 'main');
  writeFileSync(join(dir, 'c.txt'), 'pr-clean\n'); g('commit', '-qam', 'pr-clean');
  g('checkout', '-q', 'main');
  writeFileSync(join(dir, 'a.json'), '3\n'); writeFileSync(join(dir, 'b.txt'), 'main\n'); g('commit', '-qam', 'main');
  t('clean merge exits 0 with a tree oid and no conflicts', () => {
    const r = mergeTree('pr-clean', 'main');
    assert.equal(r.status, 0);
    const p = parseMergeTree(r.out);
    assert.match(p.tree, /^[0-9a-f]{40,64}$/);
    assert.deepEqual(p.conflicts, []);
  });
  t('two-path conflict exits 1 and lists both paths once, sorted', () => {
    const r = mergeTree('pr', 'main');
    assert.equal(r.status, 1);
    assert.deepEqual(parseMergeTree(r.out).conflicts, ['a.json', 'b.txt']);
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('6. syncOne() end to end against a throwaway bare remote (no GitHub)');
const root = mkdtempSync(join(tmpdir(), 'pr-sync-main-e2e-'));
const origin = join(root, 'origin.git'), work = join(root, 'work');
const gw = (cwd, ...a) => G(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false', ...a], { cwd }).trim();
try {
  G(['init', '-q', '--bare', '-b', 'main', origin]);
  G(['clone', '-q', origin, work]);
  mkdirSync(join(work, 'mcp'));
  writeFileSync(join(work, 'mcp', 'catalog.json'), '{"n":1}\n'); writeFileSync(join(work, 'src.txt'), 'base\n'); writeFileSync(join(work, 'real.txt'), 'base\n');
  gw(work, 'add', '.'); gw(work, 'commit', '-qm', 'base'); gw(work, 'push', '-q', 'origin', 'HEAD:main');
  // pr-derived: edits its own src.txt and (against policy) the derived catalog.
  gw(work, 'checkout', '-qb', 'pr-derived');
  writeFileSync(join(work, 'mcp', 'catalog.json'), '{"n":2}\n'); writeFileSync(join(work, 'src.txt'), 'pr\n'); gw(work, 'commit', '-qam', 'pr');
  gw(work, 'push', '-q', 'origin', 'pr-derived');
  const prHead = gw(work, 'rev-parse', 'HEAD');
  // pr-real: conflicts with main in real.txt.
  gw(work, 'checkout', '-qb', 'pr-real', 'main');
  writeFileSync(join(work, 'real.txt'), 'pr\n'); gw(work, 'commit', '-qam', 'pr-real'); gw(work, 'push', '-q', 'origin', 'pr-real');
  const realHead = gw(work, 'rev-parse', 'HEAD');
  gw(work, 'checkout', '-q', 'main');
  writeFileSync(join(work, 'mcp', 'catalog.json'), '{"n":3}\n'); writeFileSync(join(work, 'real.txt'), 'main\n'); gw(work, 'commit', '-qam', 'main moves');
  gw(work, 'push', '-q', 'origin', 'main');
  const mainSha = gw(work, 'rev-parse', 'HEAD');

  t('dirty-derived-only: merge commit pushed, main\'s catalog, the PR\'s own file kept, bot-sync subject', () => {
    const r = syncOne({ number: 7, headRefName: 'pr-derived', headRefOid: prHead }, mainSha, new Set(['mcp/catalog.json']), work);
    assert.equal(r.ok, true, r.why);
    const tip = G(['--git-dir', origin,'rev-parse', 'refs/heads/pr-derived']).trim();
    assert.equal(tip, r.sha);
    assert.equal(G(['--git-dir', origin,'rev-parse', `${tip}^1`, `${tip}^2`]).trim(), `${prHead}\n${mainSha}`);
    assert.equal(G(['--git-dir', origin,'show', `${tip}:mcp/catalog.json`]), '{"n":3}\n');
    assert.equal(G(['--git-dir', origin,'show', `${tip}:src.txt`]), 'pr\n');
    assert.match(G(['--git-dir', origin,'log', '-1', '--format=%s%n%b', tip]), /^chore\(bot-sync\): merge main into pr-derived \(#7\)[\s\S]*mcp\/catalog\.json/);
  });
  t('a conflict outside the allowed set: nothing pushed, branch untouched', () => {
    const r = syncOne({ number: 8, headRefName: 'pr-real', headRefOid: realHead }, mainSha, new Set(['mcp/catalog.json']), work);
    assert.equal(r.ok, false);
    assert.match(r.why, /real\.txt/);
    assert.equal(G(['--git-dir', origin,'rev-parse', 'refs/heads/pr-real']).trim(), realHead);
  });
  t('race: the branch moved since the decision → plain push rejected, flagged race, never forced', () => {
    gw(work, 'checkout', '-q', 'pr-real'); writeFileSync(join(work, 'other.txt'), 'x\n'); gw(work, 'add', 'other.txt'); gw(work, 'commit', '-qm', 'builder push'); gw(work, 'push', '-q', 'origin', 'pr-real');
    const moved = gw(work, 'rev-parse', 'HEAD');
    const r = syncOne({ number: 8, headRefName: 'pr-real', headRefOid: realHead }, realHead, new Set(), work);
    assert.equal(r.ok, false);
    assert.equal(r.race, true);
    assert.equal(G(['--git-dir', origin,'rev-parse', 'refs/heads/pr-real']).trim(), moved);
  });
  // Legacy registry fixture: base has art-1; main froze the legacy file with
  // one last entry (art-899) and already sharded art-898; PRs opened before
  // the split appended their own id to the legacy file, next to art-899.
  const LEG = (o) => `${JSON.stringify(o, null, 2)}\n`;
  const e = (row, pr) => ({ row, pr, reserved: '2026-11-01T00:00:00Z' });
  gw(work, 'checkout', '-q', 'main');
  mkdirSync(join(work, 'chaingraph', 'graph'), { recursive: true });
  writeFileSync(join(work, RESERVATIONS_LEGACY), LEG({ 'art-1': e('SEED', null) }));
  gw(work, 'add', '.'); gw(work, 'commit', '-qm', 'registry'); gw(work, 'push', '-q', 'origin', 'HEAD:main');
  const regBranch = (name, ids) => {
    gw(work, 'checkout', '-qb', name, 'main');
    writeFileSync(join(work, RESERVATIONS_LEGACY), LEG({ 'art-1': e('SEED', null), ...ids }));
    gw(work, 'commit', '-qam', name); gw(work, 'push', '-q', 'origin', name);
    return gw(work, 'rev-parse', 'HEAD');
  };
  const addOne = regBranch('pr-res-one', { 'art-900': e('ROW-900', 90) });
  const addTwo = regBranch('pr-res-two', { 'art-901': e('ROW-901', 91), 'art-902': e('ROW-902', 92) });
  const clash = regBranch('pr-res-clash', { 'art-898': e('OTHER-ROW', 93) });
  gw(work, 'checkout', '-q', 'main');
  writeFileSync(join(work, RESERVATIONS_LEGACY), LEG({ 'art-1': e('SEED', null), 'art-899': e('ROW-899', 89) }));
  mkdirSync(join(work, 'chaingraph', 'graph', 'reservations'));
  writeFileSync(join(work, 'chaingraph', 'graph', 'reservations', 'art-898.json'), shardBytes(e('ROW-898', 88)));
  gw(work, 'add', '.'); gw(work, 'commit', '-qm', 'freeze legacy, shard art-898'); gw(work, 'push', '-q', 'origin', 'HEAD:main');
  const resMain = gw(work, 'rev-parse', 'HEAD');
  const RES = new Set([RESERVATIONS_LEGACY]);

  t('merge-reservations: one added id → main\'s legacy kept, art-900 shard written, seed-check passed, pushed', () => {
    const r = syncOne({ number: 90, headRefName: 'pr-res-one', headRefOid: addOne }, resMain, RES, work);
    assert.equal(r.ok, true, r.why);
    assert.equal(G(['--git-dir', origin, 'show', `${r.sha}:${RESERVATIONS_LEGACY}`]), G(['--git-dir', origin, 'show', `${resMain}:${RESERVATIONS_LEGACY}`]));
    assert.deepEqual(JSON.parse(G(['--git-dir', origin, 'show', `${r.sha}:chaingraph/graph/reservations/art-900.json`])), e('ROW-900', 90));
    assert.match(G(['--git-dir', origin, 'log', '-1', '--format=%b', r.sha]), /seed-check passed[\s\S]*art-900\.json/);
    // The gate files were laid over and restored: the merge commit carries neither.
    assert.equal(G(['--git-dir', origin, 'ls-tree', '--name-only', r.sha, 'scripts/']).trim(), '');
  });
  t('merge-reservations: two added ids → two shards', () => {
    const r = syncOne({ number: 91, headRefName: 'pr-res-two', headRefOid: addTwo }, resMain, RES, work);
    assert.equal(r.ok, true, r.why);
    const files = G(['--git-dir', origin, 'ls-tree', '--name-only', r.sha, 'chaingraph/graph/reservations/']).trim().split('\n');
    assert.deepEqual(files, ['art-898', 'art-901', 'art-902'].map((id) => `chaingraph/graph/reservations/${id}.json`));
  });
  t('same-id collision with a different shard on main → refused, nothing pushed', () => {
    const r = syncOne({ number: 93, headRefName: 'pr-res-clash', headRefOid: clash }, resMain, RES, work);
    assert.equal(r.ok, false);
    assert.match(r.why, /art-898 already reserved on main for a different row/);
    assert.equal(G(['--git-dir', origin, 'rev-parse', 'refs/heads/pr-res-clash']).trim(), clash);
  });
  t('seed-check really runs: a main node shard with no reservation fails it → nothing pushed', () => {
    gw(work, 'checkout', '-qb', 'pr-res-seed', `${addOne}^`);
    writeFileSync(join(work, RESERVATIONS_LEGACY), LEG({ 'art-1': e('SEED', null), 'art-904': e('ROW-904', 94) }));
    gw(work, 'commit', '-qam', 'pr-res-seed'); gw(work, 'push', '-q', 'origin', 'pr-res-seed');
    const seedHead = gw(work, 'rev-parse', 'HEAD');
    gw(work, 'checkout', '-q', 'main');
    mkdirSync(join(work, 'chaingraph', 'graph', 'nodes'));
    writeFileSync(join(work, 'chaingraph', 'graph', 'nodes', 'art-950-unreserved.json'), '{}\n');
    gw(work, 'add', '.'); gw(work, 'commit', '-qm', 'unreserved node'); gw(work, 'push', '-q', 'origin', 'HEAD:main');
    const r = syncOne({ number: 94, headRefName: 'pr-res-seed', headRefOid: seedHead }, gw(work, 'rev-parse', 'HEAD'), RES, work);
    assert.equal(r.ok, false);
    assert.match(r.why, /seed-check failed[\s\S]*art-950/);
    assert.equal(G(['--git-dir', origin, 'rev-parse', 'refs/heads/pr-res-seed']).trim(), seedHead);
  });
  t('no throwaway worktree left registered', () => {
    assert.equal(gw(work, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length, 1);
  });
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('7. planReservations() + decide(): legacy id registry conflicts');
{
  const e = (row, pr) => ({ row, pr, reserved: '2026-11-01T00:00:00Z' });
  const base = { 'art-1': e('SEED', null) };
  const theirs = { ...base, 'art-899': e('ROW-899', 89) };
  const none = () => null;
  t('adds one id → one shard', () => {
    const p = planReservations({ base, ours: { ...base, 'art-900': e('A', 1) }, theirs, existingShard: none });
    assert.equal(p.ok, true);
    assert.deepEqual(p.shards, { 'chaingraph/graph/reservations/art-900.json': e('A', 1) });
  });
  t('adds two ids → two shards', () => {
    const p = planReservations({ base, ours: { ...base, 'art-900': e('A', 1), 'art-901': e('B', 2) }, theirs, existingShard: none });
    assert.deepEqual(Object.keys(p.shards).sort(), ['chaingraph/graph/reservations/art-900.json', 'chaingraph/graph/reservations/art-901.json']);
  });
  t('same-id collision: a different shard already on main → refused', () => {
    const p = planReservations({ base, ours: { ...base, 'art-900': e('A', 1) }, theirs, existingShard: (id) => (id === 'art-900' ? e('OTHER', 7) : null) });
    assert.equal(p.ok, false);
    assert.match(p.why, /art-900 already reserved on main for a different row/);
  });
  t('same-id collision: main\'s legacy carries the id for a different row → refused', () => {
    const p = planReservations({ base, ours: { ...base, 'art-899': e('MINE', 5) }, theirs, existingShard: none });
    assert.equal(p.ok, false);
  });
  t('identical shard already on main → nothing to write, still ok', () => {
    const p = planReservations({ base, ours: { ...base, 'art-900': e('A', 1) }, theirs, existingShard: () => e('A', 1) });
    assert.equal(p.ok, true);
    assert.deepEqual(p.shards, {});
  });
  t('PR removed or re-pointed an existing id → refused', () => {
    assert.equal(planReservations({ base, ours: {}, theirs, existingShard: none }).ok, false);
    assert.equal(planReservations({ base, ours: { 'art-1': e('HIJACK', 9) }, theirs, existingShard: none }).ok, false);
  });
  const ok = { ok: true, shards: { 'chaingraph/graph/reservations/art-900.json': e('A', 1) } };
  t('decide: registry alone + clean plan → merge-reservations', () => {
    const d = run({ conflicts: [RESERVATIONS_LEGACY], reservations: ok });
    assert.equal(d.action, 'merge-reservations');
    assert.deepEqual(d.paths, [RESERVATIONS_LEGACY]);
  });
  t('decide: registry + main-owned paths + clean plan → merge-reservations', () => {
    assert.equal(run({ conflicts: [RESERVATIONS_LEGACY, 'sitemap.xml'], reservations: ok }).action, 'merge-reservations');
  });
  t('decide: registry + a real conflict → stays conflict-real', () => {
    const d = run({ conflicts: [RESERVATIONS_LEGACY, 'src/thing.mjs'], reservations: ok });
    assert.equal(d.action, 'conflict-real');
    assert.deepEqual(d.paths, [RESERVATIONS_LEGACY, 'src/thing.mjs']);
  });
  t('decide: registry with a collision plan → conflict-real, reason names it', () => {
    const d = run({ conflicts: [RESERVATIONS_LEGACY], reservations: { ok: false, why: 'art-900 already reserved on main for a different row (x)' } });
    assert.equal(d.action, 'conflict-real');
    assert.match(d.reason, /^reservation-collision: art-900/);
  });
}

console.log('8. regenGate() / waitForRegen(): push:main never strands itself');
{
  // A fake clock: sleep() advances it, probe() replays a scripted run list.
  const clock = (states) => {
    let t0 = 0, i = 0, sleeps = 0;
    return {
      probe: () => states[Math.min(i++, states.length - 1)],
      sleep: (ms) => { t0 += ms; sleeps++; },
      now: () => t0,
      get sleeps() { return sleeps; },
    };
  };
  const T = { timeoutMs: 15 * 60_000, appearMs: 90_000, intervalMs: 20_000 };
  const RUNNING = { total: 1, pending: 1 }, DONE = { total: 1, pending: 0 }, NONE = { total: 0, pending: 0 };
  const A = 'a'.repeat(40), B = 'b'.repeat(40);

  t('regen finished with no commit (main unchanged) ⇒ sync still runs', () => {
    // The deadlock case: the regen run on the regen bot's own commit commits
    // nothing, so no later push would ever re-run the sync.
    const c = clock([RUNNING, RUNNING, DONE]);
    const g = regenGate({ eventSha: A, mainSha: A, probe: c.probe, fetchMain: () => A, ...T, sleep: c.sleep, now: c.now });
    assert.equal(g.proceed, true);
    assert.equal(g.wait.outcome, 'finished');
    assert.equal(c.sleeps, 2);
  });
  t('regen finished and committed (main moved) ⇒ hand off, no sync', () => {
    const c = clock([RUNNING, DONE]);
    const g = regenGate({ eventSha: A, mainSha: A, probe: c.probe, fetchMain: () => B, ...T, sleep: c.sleep, now: c.now });
    assert.equal(g.proceed, false);
    assert.equal(g.title, 'bot-sync superseded');
  });
  t('event sha already behind main ⇒ superseded without polling', () => {
    let probed = false;
    const g = regenGate({ eventSha: A, mainSha: B, probe: () => { probed = true; return DONE; }, fetchMain: () => B, ...T, sleep: () => {}, now: () => 0 });
    assert.equal(g.proceed, false);
    assert.equal(probed, false);
  });
  t('regen still running at the bound ⇒ warn and sync anyway (bounded, never strands)', () => {
    const c = clock([RUNNING]);
    const g = regenGate({ eventSha: A, mainSha: A, probe: c.probe, fetchMain: () => A, ...T, sleep: c.sleep, now: c.now });
    assert.equal(g.proceed, true);
    assert.equal(g.level, 'warning');
    assert.equal(g.wait.outcome, 'timeout');
    assert.ok(c.now() <= T.timeoutMs + T.intervalMs);
  });
  t('no regen run registers ⇒ syncs after the appear window, not the full bound', () => {
    const c = clock([NONE]);
    const w = waitForRegen(c.probe, { ...T, sleep: c.sleep, now: c.now });
    assert.equal(w.outcome, 'absent');
    assert.ok(w.waitedMs >= T.appearMs && w.waitedMs < T.timeoutMs);
  });
  t('a run that registers late is still waited for', () => {
    const c = clock([NONE, NONE, RUNNING, DONE]);
    assert.equal(waitForRegen(c.probe, { ...T, sleep: c.sleep, now: c.now }).outcome, 'finished');
  });
}

console.log(`\n${fail ? '✗' : '✓'} pr-sync-main decision tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
