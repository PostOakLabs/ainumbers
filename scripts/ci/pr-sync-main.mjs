#!/usr/bin/env node
/**
 * scripts/ci/pr-sync-main.mjs — keep open PRs current when main moves
 * (PR-AUTOFIX-MAIN-MOVED-1).
 *
 * The gap: pr-autofix.yml regenerates per-PR derivables only on a head push, so
 * when main moves nothing refreshes the open PRs. They go BEHIND, then DIRTY on
 * files main's single-writer regen owns, and a builder or the orchestrator
 * spends a loop on update-branch or a cure row. This script is the main-moved
 * half, run by the `sync-main` job of pr-autofix.yml on `push: main` (and by
 * hand through workflow_dispatch, dry-run by default):
 *
 *   for each OPEN, non-draft, same-repo PR on main (skip forks, the
 *   `no-bot-sync` label, PRs in the merge queue, and heads pushed in the last
 *   few minutes, where a builder may still be pushing):
 *     - current (head already contains main)      -> nothing to do
 *     - BEHIND, merges clean                       -> merge origin/main in, push
 *     - DIRTY only in main-owned derived paths     -> merge, take main's side of
 *                                                     those paths, commit, push
 *     - DIRTY in the legacy id registry (alone or  -> keep main's frozen
 *       with main-owned paths), PR only ADDED ids     RESERVATIONS.json, write each
 *                                                     added id as its own shard,
 *                                                     seed-check, commit, push
 *     - DIRTY anywhere else, or a same-id clash    -> do NOT resolve; one PR
 *                                                     comment per head sha
 *
 * Merge, never rebase, never force-push: builders' history and their
 * --force-with-lease stay valid, and a builder push that lands mid-run makes
 * the plain push fail, which is the race signal (one refetch + retry, then give
 * up until the next run).
 *
 * The per-PR derivables writers are NOT run here. This job holds a push-capable
 * App token, and the writers are PR-branch code. The bot-sync merge commit is
 * pushed as the App, which fires pull_request `synchronize`, and pr-autofix's
 * own two-job split (writers with no token, a separate push job that runs no
 * PR code) regenerates them exactly as it does for a builder push. Its loop
 * guard skips only `chore(autofix):` commits, so the chain stops after one
 * autofix commit.
 *
 * Main-owned paths come from the SSOT scripts/derived-artifacts.mjs (COVERED),
 * the same single-writer set MAIN-ONLY-PATHS-GATE-1 refuses on a PR, minus the
 * entries that only patch a block inside a page a PR authors (see
 * mainOwnedPaths below). Kernels and chain shards are not in that set, so a
 * conflict there is always "real". chaingraph/graph/RESERVATIONS.json is not
 * either; it gets the one mechanical resolution in planReservations().
 *
 * Usage:
 *   node scripts/ci/pr-sync-main.mjs [--dry-run] [--markdown] [--json]
 *   node scripts/ci/pr-sync-main.mjs --apply [--max-prs 10] [--event-sha <sha>]
 *   options: --repo owner/name (default $GITHUB_REPOSITORY or PostOakLabs/ainumbers)
 *            --pr <n> (one PR only)  --min-head-age-min <m> (default 10)
 *            --regen-wait-min <m> (with --event-sha: longest wait for main's
 *            derived-artifacts-regen on that sha, default 15; see regenGate)
 *
 * --dry-run (the default) is read-only on GitHub: one GraphQL listing, then a
 * local `git fetch` of the PR head objects (no refs written, no FETCH_HEAD) and
 * `git merge-tree --write-tree` to predict each merge. Nothing is pushed or
 * commented.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { COVERED, REPO } from '../derived-artifacts.mjs';
import { gitEnv } from '../_git-env-lib.mjs';

export const BOT_LOGIN = 'ainumbers-spec-sync[bot]';
export const BOT_EMAIL = 'ainumbers-spec-sync[bot]@users.noreply.github.com';
export const SKIP_LABEL = 'no-bot-sync';
export const SYNC_SUBJECT_PREFIX = 'chore(bot-sync):';
export const MAX_ATTEMPTS_PER_HEAD = 2;
export const DEFAULT_MAX_PRS = 10;
export const DEFAULT_MIN_HEAD_AGE_MIN = 15;
// Head-merge ownership: a merge into a PR head restarts its full CI, so the
// bot stands down when CI is already running on that head (rollup PENDING, only
// believed for CHECKS_PENDING_MAX_MIN after the head commit so a stuck rollup
// cannot park a PR forever) and, for a clean BEHIND PR, when it is armed (the
// merge queue rebuilds on the current main anyway).
export const ARMED_LABEL = 'automerge';
export const CHECKS_PENDING_MAX_MIN = 45;
// push:main runs wait for derived-artifacts-regen on their own sha (a run
// takes 3-4 min); see regenGate().
export const REGEN_WAIT_MIN = 15;
export const REGEN_APPEAR_SEC = 90;
export const REGEN_POLL_SEC = 20;
const MARK_CONFLICT = 'bot-sync:conflict';
const MARK_ATTEMPT = 'bot-sync:attempt';

// COVERED entries that write a generated block INSIDE a page the PR itself
// authors (node pages, chain pages, guide/hub pages). Main owns the block, the
// PR owns the rest of the page, so taking main's side of the whole file would
// drop the PR's own content. Their pages stay out of the main-owned set unless
// another, whole-file entry also declares them.
export const PER_PR_PAGE_PATCHERS = new Set(['node-page-footers', 'hub-scenes', 'chain-ask-agent']);
// writesReport entries whose bare-tree prefix is a tree PRs author into
// (`tools`, `chaingraph`, `manifests/`). The other writesReport prefixes
// (`chaingraph/receipt-bundles`, `chaingraph/okf`, `chaingraph/register`,
// `fv-status`, `registry/kernel`, `skills`, `source`) are generated whole by
// their entry and are main-owned as prefixes.
export const BROAD_PREFIX_ENTRIES = new Set(['page-md-twins', 'manifest-examples']);
// verify-counts --fix rewrites only the <!--COUNT:k-->N<!--/COUNT--> and
// data-count="k">N< values inside pages that are otherwise hand-authored prose
// (about.html, the guide hubs, the explainers). Its .html pages are resolvable
// only when the PR's own diff on them changed sentinel values and nothing else
// (isSentinelOnlyDiff), so a prose edit is never dropped. Its non-HTML outputs
// (.well-known/*.json, llms.txt) are machine files and main-owned outright.
export const SENTINEL_PATCHER = 'counts';

/**
 * The paths this sync may resolve by taking main's side outright, derived
 * from COVERED. Exact paths: every declared artifact, except those of
 * PER_PR_PAGE_PATCHERS and the .html pages of SENTINEL_PATCHER (a path another
 * whole-file entry also declares stays in). Prefixes: the artifacts of
 * writesReport entries other than BROAD_PREFIX_ENTRIES.
 * @param {Array<{id:string, artifacts:string[], writesReport?:string}>} [covered]
 * @returns {{exact:Set<string>, prefixes:string[], has:(p:string)=>boolean}}
 */
export function mainOwnedPaths(covered = COVERED) {
  const exact = new Set();
  const prefixes = new Set();
  for (const c of covered) {
    if (PER_PR_PAGE_PATCHERS.has(c.id) || BROAD_PREFIX_ENTRIES.has(c.id)) continue;
    for (const a of c.artifacts) {
      if (c.writesReport) { prefixes.add(a.replace(/\/+$/, '')); exact.add(a.replace(/\/+$/, '')); continue; }
      if (c.id === SENTINEL_PATCHER && a.endsWith('.html')) continue;
      exact.add(a);
    }
  }
  const pre = [...prefixes].sort();
  return { exact, prefixes: pre, has: (p) => exact.has(p) || pre.some((x) => p.startsWith(`${x}/`)) };
}

/**
 * The sentinel patcher's .html pages that are not main-owned outright:
 * resolvable per PR, when isSentinelOnlyDiff holds for the PR's own diff.
 * @returns {Set<string>}
 */
export function sentinelOwnedPaths(covered = COVERED) {
  const owned = mainOwnedPaths(covered);
  const out = new Set();
  for (const c of covered) {
    if (c.id !== SENTINEL_PATCHER) continue;
    for (const a of c.artifacts) if (a.endsWith('.html') && !owned.has(a)) out.add(a);
  }
  return out;
}

function normalizeSentinels(line) {
  return line
    .replace(/<!--COUNT:([^-]+?)-->\d+<!--\/COUNT-->/g, '<!--COUNT:$1-->#<!--/COUNT-->')
    .replace(/(<[^>]+\bdata-count="[^"]+"[^>]*>)\d+(<\/)/g, '$1#$2');
}

/**
 * True when a unified diff (`git diff -U0 base head -- <page>`) changes count
 * sentinel values and nothing else: with every sentinel value masked, the
 * removed and added lines are the same multiset. An empty diff is false (there
 * is nothing the PR changed, so a conflict there is not this class).
 * @param {string} diffText
 */
export function isSentinelOnlyDiff(diffText) {
  const removed = [], added = [];
  for (const l of diffText.split(/\r?\n/)) {
    if (l.startsWith('---') || l.startsWith('+++')) continue;
    if (l.startsWith('-')) removed.push(normalizeSentinels(l.slice(1)));
    else if (l.startsWith('+')) added.push(normalizeSentinels(l.slice(1)));
  }
  if (removed.length === 0 && added.length === 0) return false;
  removed.sort(); added.sort();
  return removed.length === added.length && removed.every((l, i) => l === added[i]);
}

/**
 * Parse `git merge-tree --write-tree --name-only --no-messages` output: the
 * first line is the result tree oid, every following non-empty line a
 * conflicted path (each path once).
 * @param {string} stdout
 * @returns {{tree:string, conflicts:string[]}}
 */
export function parseMergeTree(stdout) {
  const lines = stdout.split(/\r?\n/);
  const tree = (lines.shift() || '').trim();
  const conflicts = [...new Set(lines.map((l) => l.trim()).filter(Boolean))].sort();
  return { tree, conflicts };
}

/**
 * The decision for one PR. Pure: everything it needs is in `input`.
 * @param {object} input
 * @param {object} input.pr  {number, isDraft, isCrossRepository, baseRefName,
 *                            headRefName, labels:string[], inMergeQueue, headCommittedAt, checksState}
 * @param {boolean} input.behind      head does not contain main
 * @param {string[]|null} input.conflicts  predicted conflicted paths ([] = clean)
 * @param {Set<string>} input.mainOwned
 * @param {Set<string>} [input.sentinelOk]  sentinel-owned pages whose PR diff is sentinel-only
 * @param {number} [input.attempts]   failed bot-sync attempts already on this head
 * @param {boolean} [input.notified]  a real-conflict comment already exists for this head
 * @param {number} [input.now]        epoch ms
 * @param {number} [input.minHeadAgeMs]
 * @returns {{action:'skip'|'merge-clean'|'merge-derived'|'conflict-real', reason:string, paths:string[], notify?:boolean}}
 */
/*
 * Reservation registry (scripts/check-id-collision.mjs). Since the shard split
 * on main, a reservation is one file per id under RESERVATION_SHARD_DIR, and
 * the legacy single-object registry is frozen (still read: shards ∪ legacy).
 * A PR opened before the split added its id to the legacy file, which now
 * conflicts with main. That conflict is mechanical when the PR only ADDED ids:
 * keep main's frozen legacy file and move each added entry to its own shard.
 */
export const RESERVATIONS_LEGACY = 'chaingraph/graph/RESERVATIONS.json';
export const RESERVATION_SHARD_DIR = 'chaingraph/graph/reservations';
export const shardPath = (id) => `${RESERVATION_SHARD_DIR}/${id}.json`;
export const shardBytes = (entry) => `${JSON.stringify(entry, null, 2)}\n`;
// Decisions that merge and push.
export const SYNC_ACTIONS = new Set(['merge-clean', 'merge-derived', 'merge-reservations']);

const sameJson = (a, b) => isDeepStrictEqual(a, b);

/**
 * Plan the legacy-registry resolution. base/ours/theirs: the legacy object at
 * the merge base, on the PR head, and on main (null = file absent).
 * existingShard(id): the shard entry already in the target tree, or null.
 * Returns { ok: true, shards: { path: entry } } or { ok: false, why }.
 * Refuses (a real conflict, never resolved) when the PR removed or edited an
 * existing id differently from main, or when an id it added already exists on
 * main (legacy or shard) with different content: a same-id collision.
 */
export function planReservations({ base, ours, theirs, existingShard }) {
  if (!ours || !theirs) return { ok: false, why: `${RESERVATIONS_LEGACY} missing on one side` };
  const b = base || {};
  const shards = {};
  const refuse = [];
  for (const id of Object.keys(b)) {
    if (!(id in ours)) refuse.push(`${id} removed by the PR`);
  }
  for (const [id, entry] of Object.entries(ours)) {
    if (id in b) {
      if (!sameJson(b[id], entry) && !sameJson(theirs[id], entry)) refuse.push(`${id} edited by the PR and by main`);
      continue;
    }
    if (id in theirs && !sameJson(theirs[id], entry)) { refuse.push(`${id} already reserved on main for a different row (legacy)`); continue; }
    const have = existingShard(id);
    if (have === undefined) { refuse.push(`${shardPath(id)} unreadable`); continue; }
    if (have !== null) {
      if (!sameJson(have, entry)) refuse.push(`${id} already reserved on main for a different row (${shardPath(id)})`);
      continue;
    }
    if (id in theirs) continue; // main's frozen legacy already carries the identical entry
    shards[shardPath(id)] = entry;
  }
  return refuse.length ? { ok: false, why: refuse.join('; ') } : { ok: true, shards };
}

export function decide(input) {
  const { pr, behind, conflicts, mainOwned } = input;
  const attempts = input.attempts || 0;
  const now = input.now ?? Date.now();
  const minAge = input.minHeadAgeMs ?? DEFAULT_MIN_HEAD_AGE_MIN * 60_000;
  const skip = (reason) => ({ action: 'skip', reason, paths: [] });

  if (pr.isCrossRepository) return skip('fork');
  if (pr.baseRefName !== 'main') return skip('base-not-main');
  if (pr.headRefName === 'main') return skip('head-is-main');
  if (pr.isDraft) return skip('draft');
  if ((pr.labels || []).includes(SKIP_LABEL)) return skip(`label:${SKIP_LABEL}`);
  if (pr.inMergeQueue) return skip('in-merge-queue');
  if (!behind && (!conflicts || conflicts.length === 0)) return skip('current');
  if (conflicts === null) return skip('merge-unknown');
  if (attempts >= MAX_ATTEMPTS_PER_HEAD) return skip(`attempts:${attempts}`);
  const committed = pr.headCommittedAt ? Date.parse(pr.headCommittedAt) : NaN;
  if (Number.isFinite(committed) && now - committed < minAge) return skip('fresh-head');
  if (pr.checksState === 'PENDING' && Number.isFinite(committed) && now - committed < CHECKS_PENDING_MAX_MIN * 60_000) return skip('checks-running');
  if (conflicts.length === 0 && (pr.labels || []).includes(ARMED_LABEL)) return skip('armed-queue-rebuilds');

  if (conflicts.length === 0) return { action: 'merge-clean', reason: 'behind', paths: [] };
  const sentinelOk = input.sentinelOk || new Set();
  const real = conflicts.filter((p) => !mainOwned.has(p) && !sentinelOk.has(p));
  if (real.length === 0) return { action: 'merge-derived', reason: 'dirty-derived-only', paths: conflicts };
  // The legacy registry alone (plus main-owned paths) resolves when the plan
  // is clean; a collision in it stays real, named in the reason.
  if (real.length === 1 && real[0] === RESERVATIONS_LEGACY) {
    const plan = input.reservations;
    if (plan && plan.ok) return { action: 'merge-reservations', reason: 'legacy-registry-adds', paths: conflicts, shards: plan.shards };
    return { action: 'conflict-real', reason: plan ? `reservation-collision: ${plan.why}` : 'dirty-real', paths: real, notify: !input.notified };
  }
  return { action: 'conflict-real', reason: 'dirty-real', paths: real, notify: !input.notified };
}

/* ───────────────────────────── I/O half ───────────────────────────── */

function parseArgs(argv) {
  const o = {
    apply: false, markdown: false, json: false, repo: process.env.GITHUB_REPOSITORY || 'PostOakLabs/ainumbers',
    maxPrs: DEFAULT_MAX_PRS, pr: null, eventSha: null, minHeadAgeMin: DEFAULT_MIN_HEAD_AGE_MIN,
    regenWaitMin: REGEN_WAIT_MIN,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === '--apply') o.apply = true;
    else if (a === '--dry-run') o.apply = false;
    else if (a === '--markdown') o.markdown = true;
    else if (a === '--json') o.json = true;
    else if (a === '--repo') o.repo = next();
    else if (a === '--max-prs') o.maxPrs = Number(next());
    else if (a === '--pr') o.pr = Number(next());
    else if (a === '--event-sha') o.eventSha = next();
    else if (a === '--min-head-age-min') o.minHeadAgeMin = Number(next());
    else if (a === '--regen-wait-min') o.regenWaitMin = Number(next());
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(o.repo)) throw new Error(`bad --repo ${o.repo}`);
  if (!Number.isInteger(o.maxPrs) || o.maxPrs < 0) throw new Error('--max-prs must be a non-negative integer');
  if (!(o.regenWaitMin >= 0)) throw new Error('--regen-wait-min must be a non-negative number');
  return o;
}

// Every git call runs with an empty hooks dir: the trees this script checks
// out are PR data, and nothing in them may execute while the App token is set.
let HOOKS_DIR = null;
function git(args, opts = {}) {
  HOOKS_DIR ??= mkdtempSync(join(tmpdir(), 'bot-sync-nohooks-'));
  return execFileSync('git', ['-c', `core.hooksPath=${HOOKS_DIR}`, ...args], {
    cwd: opts.cwd || REPO, env: gitEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20,
  });
}
function gitOk(args, opts) {
  try { return { ok: true, out: git(args, opts) }; } catch (e) { return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || ''), status: e.status }; }
}
function gh(args, input, token) {
  const env = token ? { ...process.env, GH_TOKEN: token } : process.env;
  return execFileSync('gh', args, { cwd: REPO, env, encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
}

const PR_QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){
  pullRequests(states:OPEN,first:100,after:$cursor,orderBy:{field:CREATED_AT,direction:ASC}){
    pageInfo{hasNextPage endCursor}
    nodes{number title isDraft isCrossRepository baseRefName headRefName headRefOid
      mergeable mergeStateStatus mergeQueueEntry{state}
      labels(first:50){nodes{name}}
      commits(last:1){nodes{commit{committedDate statusCheckRollup{state}}}}}}}}`;

function listOpenPrs(repo) {
  const [owner, name] = repo.split('/');
  const out = [];
  let cursor = null;
  for (;;) {
    const args = ['api', 'graphql', '-f', `query=${PR_QUERY}`, '-F', `owner=${owner}`, '-F', `name=${name}`];
    if (cursor) args.push('-f', `cursor=${cursor}`);
    const page = JSON.parse(gh(args)).data.repository.pullRequests;
    for (const n of page.nodes) {
      out.push({
        number: n.number, title: n.title, isDraft: n.isDraft, isCrossRepository: n.isCrossRepository,
        baseRefName: n.baseRefName, headRefName: n.headRefName, headRefOid: n.headRefOid,
        mergeable: n.mergeable, mergeStateStatus: n.mergeStateStatus, inMergeQueue: !!n.mergeQueueEntry,
        labels: n.labels.nodes.map((l) => l.name),
        headCommittedAt: n.commits.nodes[0]?.commit?.committedDate || null,
        checksState: n.commits.nodes[0]?.commit?.statusCheckRollup?.state || null,
      });
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

/** Fetch commit objects by sha without writing any ref or FETCH_HEAD. */
function fetchShas(shas) {
  const want = [...new Set(shas)].filter((s) => !gitOk(['cat-file', '-e', `${s}^{commit}`]).ok);
  for (let i = 0; i < want.length; i += 50) {
    git(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', 'origin', ...want.slice(i, i + 50)]);
  }
}

function predict(headSha, mainSha) {
  const behind = !gitOk(['merge-base', '--is-ancestor', mainSha, headSha]).ok;
  if (!behind) return { behind, conflicts: [] };
  const r = gitOk(['merge-tree', '--write-tree', '--name-only', '--no-messages', headSha, mainSha]);
  if (r.ok) return { behind, conflicts: [] };
  if (r.status !== 1) return { behind, conflicts: null, error: r.err.trim() };
  const conflicts = parseMergeTree(r.out).conflicts;
  // Sentinel-owned pages: eligible only if the PR's own change to them is
  // count values and nothing else.
  const sentinelOk = new Set();
  const candidates = conflicts.filter((p) => SENTINEL_OWNED().has(p));
  if (candidates.length) {
    const base = git(['merge-base', headSha, mainSha]).trim();
    for (const p of candidates) {
      if (isSentinelOnlyDiff(git(['diff', '-U0', '--no-color', '--no-ext-diff', base, headSha, '--', p]))) sentinelOk.add(p);
    }
  }
  const reservations = conflicts.includes(RESERVATIONS_LEGACY)
    ? reservationPlanAt(headSha, mainSha, (id) => readJsonAt(mainSha, shardPath(id))) : undefined;
  return { behind, conflicts, sentinelOk, reservations };
}

// A JSON blob at <rev>:<path>: the parsed value, null when the path is
// absent, undefined when present but unparseable (the caller refuses).
function readJsonAt(rev, path, cwd) {
  if (!gitOk(['cat-file', '-e', `${rev}:${path}`], { cwd }).ok) return null;
  try { return JSON.parse(git(['show', `${rev}:${path}`], { cwd })); } catch { return undefined; }
}

function reservationPlanAt(headSha, mainSha, existingShard, cwd) {
  const base = git(['merge-base', headSha, mainSha], { cwd }).trim();
  const sides = [base, headSha, mainSha].map((rev) => readJsonAt(rev, RESERVATIONS_LEGACY, cwd));
  if (sides.includes(undefined)) return { ok: false, why: `${RESERVATIONS_LEGACY} is not valid JSON on one side` };
  const [b, ours, theirs] = sides;
  return planReservations({ base: b, ours, theirs, existingShard });
}
let _sentinelOwned = null;
const SENTINEL_OWNED = () => (_sentinelOwned ??= sentinelOwnedPaths());

function botComments(repo, number) {
  const raw = gh(['api', '--paginate', `repos/${repo}/issues/${number}/comments`, '--jq',
    `.[] | select(.user.login == "${BOT_LOGIN}") | .body | @json`]);
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function markerCount(bodies, mark, head) {
  return bodies.filter((b) => b.includes(`<!-- ${mark} head=${head} -->`)).length;
}
function comment(repo, number, body) {
  gh(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '-F', 'body=@-'], body);
}

/**
 * Merge main into one PR head in a throwaway worktree and push. `allowed` is
 * the decision's resolvable set; any unmerged path outside it aborts.
 * Returns {ok, sha?, why?, race?}. `repoDir` exists for the test's throwaway
 * repo; CI uses the trusted main checkout.
 */
function readJsonFile(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return undefined; }
}

// Run check-id-collision.mjs --seed-check on the merged tree with MAIN's copy
// of the gate, never the PR's: this job holds the push token, so no PR-branch
// code may run here. The gate resolves the repo from its own location, so
// main's two files are laid over the tree's copies for the run and the merged
// versions restored from the index afterwards. Tokens are dropped from its env.
const SEED_GATE_FILES = ['scripts/check-id-collision.mjs', 'scripts/_git-env-lib.mjs'];
function seedCheck(wt) {
  mkdirSync(join(wt, 'scripts'), { recursive: true });
  for (const f of SEED_GATE_FILES) copyFileSync(join(REPO, f), join(wt, f));
  const env = { ...gitEnv() };
  for (const k of ['GH_TOKEN', 'GITHUB_TOKEN', 'APP_TOKEN', 'ACTIONS_READ_TOKEN']) delete env[k];
  try {
    execFileSync(process.execPath, [join(wt, 'scripts', 'check-id-collision.mjs'), '--seed-check'],
      { cwd: wt, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ') };
  } finally {
    for (const f of SEED_GATE_FILES) {
      if (!gitOk(['checkout', '--', f], { cwd: wt }).ok) rmSync(join(wt, f), { force: true });
    }
  }
}

export function syncOne(pr, mainSha, allowed, repoDir = REPO) {
  const wt = mkdtempSync(join(tmpdir(), `bot-sync-${pr.number}-`));
  const ident = ['-c', `user.name=${BOT_LOGIN}`, '-c', `user.email=${BOT_EMAIL}`];
  try {
    git(['worktree', 'add', '--quiet', '--detach', wt, pr.headRefOid], { cwd: repoDir });
    const subject = `${SYNC_SUBJECT_PREFIX} merge main into ${pr.headRefName} (#${pr.number})`;
    const m = gitOk([...ident, 'merge', '--no-ff', '--no-edit', '-m', subject, mainSha], { cwd: wt });
    if (!m.ok) {
      const unmerged = git(['diff', '--name-only', '--diff-filter=U', '-z'], { cwd: wt }).split('\0').filter(Boolean).sort();
      const real = unmerged.filter((p) => !allowed.has(p));
      if (unmerged.length === 0 || real.length) {
        return { ok: false, why: `merge result differs from prediction (unmerged: ${unmerged.join(', ') || 'none'})` };
      }
      // Re-plan against the merged tree itself: its shard dir is main's plus
      // whatever the PR added, so a same-id shard on either side is seen.
      let plan = null;
      if (unmerged.includes(RESERVATIONS_LEGACY)) {
        plan = reservationPlanAt(pr.headRefOid, mainSha, (id) => readJsonFile(join(wt, shardPath(id))), wt);
        if (!plan.ok) return { ok: false, why: `reservation collision: ${plan.why}` };
      }
      for (const p of unmerged) {
        if (gitOk(['cat-file', '-e', `${mainSha}:${p}`], { cwd: wt }).ok) git(['checkout', mainSha, '--', p], { cwd: wt });
        else git(['rm', '--quiet', '--', p], { cwd: wt });
      }
      const moved = plan ? Object.keys(plan.shards).sort() : [];
      for (const p of moved) {
        mkdirSync(join(wt, RESERVATION_SHARD_DIR), { recursive: true });
        writeFileSync(join(wt, p), shardBytes(plan.shards[p]));
        git(['add', '--', p], { cwd: wt });
      }
      const left = git(['diff', '--name-only', '--diff-filter=U'], { cwd: wt }).trim();
      if (left) return { ok: false, why: `still unmerged after taking main's side: ${left}` };
      if (plan) {
        const seed = seedCheck(wt);
        if (!seed.ok) return { ok: false, why: `check-id-collision --seed-check failed on the merged tree: ${seed.err}` };
      }
      const derived = unmerged.filter((p) => p !== RESERVATIONS_LEGACY);
      const msgFile = join(wt, '..', `bot-sync-msg-${pr.number}.txt`);
      writeFileSync(msgFile, `${subject}\n\n` +
        (derived.length ? `Conflicts in main-owned derived paths (scripts/derived-artifacts.mjs);\ntook main's version, main's regen re-derives them after merge:\n${derived.map((p) => `  ${p}`).join('\n')}\n` : '') +
        (plan ? `${derived.length ? '\n' : ''}Kept main's frozen ${RESERVATIONS_LEGACY}; moved the ${moved.length} id(s) this PR added to\nper-id shards (scripts/check-id-collision.mjs --seed-check passed on the merged tree):\n${moved.map((p) => `  ${p}`).join('\n') || '  (none: main already carries them)'}\n` : ''));
      git([...ident, 'commit', '--quiet', '-F', msgFile], { cwd: wt });
      rmSync(msgFile, { force: true });
    }
    const sha = git(['rev-parse', 'HEAD'], { cwd: wt }).trim();
    const p = gitOk(['push', '--quiet', 'origin', `${sha}:refs/heads/${pr.headRefName}`], { cwd: wt });
    if (!p.ok) return { ok: false, race: true, why: `push rejected (${p.err.trim().split('\n').pop()})` };
    return { ok: true, sha };
  } finally {
    gitOk(['worktree', 'remove', '--force', wt], { cwd: repoDir });
    rmSync(wt, { recursive: true, force: true });
    gitOk(['worktree', 'prune'], { cwd: repoDir });
  }
}

// The App token carries only contents + pull-requests; reading Actions runs
// uses the job's GITHUB_TOKEN (actions: read), passed as ACTIONS_READ_TOKEN.
function regenRuns(repo, sha) {
  const raw = gh(['api', `repos/${repo}/actions/workflows/derived-artifacts-regen.yml/runs?head_sha=${sha}&per_page=10`,
    '--jq', '[(.workflow_runs | length), ([.workflow_runs[] | select(.status != "completed")] | length)] | @tsv'], undefined, process.env.ACTIONS_READ_TOKEN);
  const [total, pending] = raw.trim().split('\t').map(Number);
  return { total, pending };
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// Poll derived-artifacts-regen's runs on one sha until they have all
// finished. 'absent': no run registered within appearMs (it fires on the same
// push as this job, so it normally shows up in seconds). 'timeout': still
// running after timeoutMs.
export function waitForRegen(probe, { timeoutMs, appearMs, intervalMs, sleep = sleepSync, now = Date.now }) {
  const start = now();
  for (;;) {
    const { total, pending } = probe();
    const waitedMs = now() - start;
    if (total > 0 && pending === 0) return { outcome: 'finished', waitedMs };
    if (total === 0 && waitedMs >= appearMs) return { outcome: 'absent', waitedMs };
    if (waitedMs >= timeoutMs) return { outcome: 'timeout', waitedMs };
    sleep(intervalMs);
  }
}

// Whether a push:main run syncs. It WAITS for the regen on its own sha
// instead of exiting: a regen that commits nothing (the run on the regen
// bot's own commit, every time) pushes nothing, so "exit and let the next
// push re-run us" never re-ran it. After the wait, main is read again: if the
// regen committed, main moved, and that commit's push run syncs instead. A
// timeout still syncs, so the job can never strand itself; main-owned paths
// it merges are re-derived by main's regen after the PR lands either way.
export function regenGate({ eventSha, mainSha, probe, fetchMain, timeoutMs = REGEN_WAIT_MIN * 60_000,
  appearMs = REGEN_APPEAR_SEC * 1000, intervalMs = REGEN_POLL_SEC * 1000, sleep, now }) {
  const short = (s) => s.slice(0, 7);
  if (eventSha !== mainSha) {
    return { proceed: false, level: 'notice', title: 'bot-sync superseded',
      msg: `main moved past ${short(eventSha)} (now ${short(mainSha)}); the newer push's run syncs against it.` };
  }
  const w = waitForRegen(probe, { timeoutMs, appearMs, intervalMs, sleep, now });
  const after = fetchMain();
  if (after !== mainSha) {
    return { proceed: false, level: 'notice', title: 'bot-sync superseded', wait: w,
      msg: `derived-artifacts-regen on ${short(mainSha)} ${w.outcome}; main moved to ${short(after)}, whose push run syncs against it.` };
  }
  if (w.outcome === 'timeout') {
    return { proceed: true, level: 'warning', title: 'bot-sync regen wait timed out', wait: w,
      msg: `derived-artifacts-regen still running on ${short(mainSha)} after ${Math.round(w.waitedMs / 60_000)} min; syncing against it anyway.` };
  }
  return { proceed: true, level: 'notice', title: 'bot-sync regen settled', wait: w,
    msg: `derived-artifacts-regen on ${short(mainSha)} ${w.outcome} after ${Math.round(w.waitedMs / 1000)} s with main unchanged; syncing.` };
}

function table(rows) {
  const withResult = rows.some((r) => r.result);
  const out = [`| PR | GitHub state | behind | conflicts | decision | paths |${withResult ? ' result |' : ''}`, `|---|---|---|---|---|---|${withResult ? '---|' : ''}`];
  for (const r of rows) {
    const paths = r.decision.paths.length ? r.decision.paths.slice(0, 6).map((p) => `\`${p}\``).join('<br>') + (r.decision.paths.length > 6 ? `<br>… +${r.decision.paths.length - 6}` : '') : '';
    const what = r.decision.action === 'skip' ? `skip (${r.decision.reason})` : r.decision.action;
    out.push(`| #${r.pr.number} | ${r.pr.mergeStateStatus}/${r.pr.mergeable} | ${r.behind ? 'yes' : 'no'} | ${r.conflicts === null ? '?' : r.conflicts.length} | ${what} | ${paths} |${withResult ? ` ${r.result || ''} |` : ''}`);
  }
  return out.join('\n');
}

function summarize(rows) {
  const s = {};
  for (const r of rows) {
    const k = r.decision.action === 'skip' ? `skip:${r.decision.reason}` : r.decision.action;
    s[k] = (s[k] || 0) + 1;
  }
  return s;
}

async function main() {
  const o = parseArgs(process.argv);
  const mode = o.apply ? 'APPLY' : 'DRY-RUN';
  console.error(`pr-sync-main: ${mode} on ${o.repo}, max ${o.maxPrs} push(es)`);

  git(['fetch', '--quiet', '--no-tags', 'origin', 'main']);
  const mainSha = git(['rev-parse', 'FETCH_HEAD^{commit}']).trim();
  if (o.apply && o.eventSha) {
    const g = regenGate({
      eventSha: o.eventSha, mainSha,
      probe: () => regenRuns(o.repo, mainSha),
      fetchMain: () => { git(['fetch', '--quiet', '--no-tags', 'origin', 'main']); return git(['rev-parse', 'FETCH_HEAD^{commit}']).trim(); },
      timeoutMs: o.regenWaitMin * 60_000,
    });
    console.log(`::${g.level} title=${g.title}::${g.msg}`);
    if (!g.proceed) return;
  }

  const owned = mainOwnedPaths();
  let prs = listOpenPrs(o.repo);
  if (o.pr) prs = prs.filter((p) => p.number === o.pr);
  fetchShas(prs.filter((p) => !p.isCrossRepository).map((p) => p.headRefOid));

  const rows = [];
  for (const pr of prs) {
    const pred = pr.isCrossRepository ? { behind: false, conflicts: [] } : predict(pr.headRefOid, mainSha);
    let attempts = 0, notified = false;
    // Comment markers are read only for PRs that would act (one API call each).
    const first = decide({ pr, ...pred, mainOwned: owned, minHeadAgeMs: o.minHeadAgeMin * 60_000 });
    if (o.apply && first.action !== 'skip') {
      const bodies = botComments(o.repo, pr.number);
      attempts = markerCount(bodies, MARK_ATTEMPT, pr.headRefOid);
      notified = markerCount(bodies, MARK_CONFLICT, pr.headRefOid) > 0;
    }
    const decision = decide({ pr, ...pred, mainOwned: owned, attempts, notified, minHeadAgeMs: o.minHeadAgeMin * 60_000 });
    rows.push({ pr, behind: pred.behind, conflicts: pred.conflicts, decision });
  }

  if (o.apply) {
    let pushes = 0;
    for (const r of rows) {
      const { pr, decision } = r;
      if (decision.action === 'conflict-real') {
        if (decision.notify) {
          comment(o.repo, pr.number,
            `bot-sync: real conflict in ${decision.paths.map((p) => `\`${p}\``).join(', ')}, needs a cure.\n\n` +
            `Merging \`main\` (${mainSha.slice(0, 7)}) into \`${pr.headRefName}\` conflicts outside the main-owned derived paths, so the bot did not resolve it. ` +
            (decision.reason.startsWith('reservation-collision') ? `The id registry conflict is not a plain add: ${decision.reason.replace(/^reservation-collision: /, '')}. ` : '') +
            `Label \`${SKIP_LABEL}\` to opt this PR out.\n\n<!-- ${MARK_CONFLICT} head=${pr.headRefOid} -->`);
          r.result = 'commented';
        } else r.result = 'already-notified';
        continue;
      }
      if (!SYNC_ACTIONS.has(decision.action)) continue;
      if (pushes >= o.maxPrs) { r.result = 'deferred (max-prs)'; continue; }
      pushes++;
      let res = syncOne(pr, mainSha, new Set(decision.paths));
      if (!res.ok && res.race) {
        // Attempt 2: a builder pushed mid-run. Re-read the head, re-decide, retry once.
        const fresh = listOpenPrs(o.repo).find((p) => p.number === pr.number);
        if (fresh && fresh.headRefOid !== pr.headRefOid) {
          fetchShas([fresh.headRefOid]);
          const d2 = decide({ pr: fresh, ...predict(fresh.headRefOid, mainSha), mainOwned: owned, minHeadAgeMs: o.minHeadAgeMin * 60_000 });
          if (SYNC_ACTIONS.has(d2.action)) res = syncOne(fresh, mainSha, new Set(d2.paths));
          else { r.result = `left alone after race: ${d2.action} (${d2.reason})`; continue; }
        }
      }
      if (res.ok) { r.result = `pushed ${res.sha.slice(0, 7)}`; continue; }
      r.result = `failed: ${res.why}`;
      comment(o.repo, pr.number,
        `bot-sync: could not merge \`main\` (${mainSha.slice(0, 7)}) into this branch: ${res.why}. ` +
        `The bot retries on the next main move, at most ${MAX_ATTEMPTS_PER_HEAD} times per head.\n\n<!-- ${MARK_ATTEMPT} head=${pr.headRefOid} -->`);
    }
  }

  const summary = summarize(rows);
  if (o.json) console.log(JSON.stringify({ mode, mainSha, summary, rows: rows.map((r) => ({ number: r.pr.number, state: r.pr.mergeStateStatus, behind: r.behind, conflicts: r.conflicts, decision: r.decision, result: r.result })) }, null, 2));
  else if (o.markdown) console.log(`main ${mainSha.slice(0, 7)} · ${rows.length} open PR(s) · ${mode}\n\n${table(rows)}\n\n${Object.entries(summary).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
  else {
    for (const r of rows) {
      const p = r.decision.paths;
      const shown = p.slice(0, 8).join(' ') + (p.length > 8 ? ` … +${p.length - 8}` : '');
      console.log(`#${r.pr.number}\t${r.decision.action}\t${r.decision.reason}\t${shown}${r.result ? `\t=> ${r.result}` : ''}`);
    }
    console.log(JSON.stringify(summary));
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((e) => { console.error(`pr-sync-main: ${e.stack || e}`); process.exit(1); })
    .finally(() => { if (HOOKS_DIR) rmSync(HOOKS_DIR, { recursive: true, force: true }); });
}
