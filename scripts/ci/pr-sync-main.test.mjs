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
 *      moved mid-run rejects the plain push and is flagged as a race.
 *   7. regenGate(): a push:main run waits for the regen on its sha and still
 *      syncs when that regen committed nothing (the run on the regen bot's
 *      own commit); hands off when the regen committed; a timeout or a regen
 *      that never registers still syncs, so the job cannot strand itself.
 * Run: node scripts/ci/pr-sync-main.test.mjs   (exit 0 = all green)
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decide, mainOwnedPaths, sentinelOwnedPaths, isSentinelOnlyDiff, parseMergeTree, syncOne,
  waitForRegen, regenGate, SKIP_LABEL, MAX_ATTEMPTS_PER_HEAD,
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
  t('no throwaway worktree left registered', () => {
    assert.equal(gw(work, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length, 1);
  });
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('7. regenGate() / waitForRegen(): push:main never strands itself');
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
