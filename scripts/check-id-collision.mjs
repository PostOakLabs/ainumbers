#!/usr/bin/env node
/**
 * scripts/check-id-collision.mjs — PR id-collision gate (PR-ID-COLLISION-GATE-1).
 *
 * The evening of 2026-09-05/06, art-685 collided twice (PR #1748 vs #1749, both
 * self-derived "next free") and art-686 twice (#1748 renumbered into it while
 * #1759 minted it and a board row carried "art-686 reserved"). Existing gates
 * (check-tool-number-unique.mjs, replay fixture `nodenum-unique`) only see a
 * duplicate once BOTH copies are in ONE tree — which is never true for two open
 * PRs. This gate makes uniqueness a PRE-MERGE fact per PR:
 *
 *   (a) the id is not already used on origin/main by a DIFFERENT path (minting
 *       an id main already has — modification of your own main shard is fine);
 *   (b) the reservation registry carries `art-<id>` mapped to THIS row/PR
 *       (missing, or mapped to a different row/PR, is a refusal). The registry
 *       is the lock: since RESERVATIONS-SHARD-1 (2026-11-03) it is one file per
 *       id, chaingraph/graph/reservations/art-<n>.json ({row, pr, reserved}).
 *       Two PRs reserving the SAME id add the same path with different bytes
 *       (add/add conflict in the merge queue — git conflict = mechanical
 *       collision detection); two PRs reserving DIFFERENT ids touch different
 *       files and no longer conflict. The legacy single-object
 *       chaingraph/graph/RESERVATIONS.json is still read while it exists
 *       (union: an id in either counts) so PRs opened before the split keep
 *       passing; an id present in both with different content is a refusal.
 *       New reservations go only to the directory;
 *   (c) no OTHER open PR already claims the id (token-free: `gh pr list` using
 *       the job's GITHUB_TOKEN; skipped on merge_group — the queue is serial —
 *       and reported, never silent, when gh is unavailable locally; SO #34c:
 *       a skipped leg is named, never a silent green).
 *
 * Same checks apply to tool numbers (tools/<n>-*.html) and node manifests
 * (manifests/art-<n>-*.manifest.json), keyed to the same art-<n> number.
 * Node shards and manifests match BOTH spellings, art-<n>-slug and the bare
 * <n>-slug, keyed to the same art-<n> id (ID-COLLISION-BARE-PREFIX-1).
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm/Ajv ever).
 *
 * Usage:
 *   node scripts/check-id-collision.mjs              # diff vs origin/main (CI + local)
 *   node scripts/check-id-collision.mjs --seed-check # registry (shards ∪ legacy) covers every main node shard id, no mismatch
 *   node scripts/check-id-collision.mjs --self-test  # RED/GREEN fixture proof (SO #34c)
 *   node scripts/check-id-collision.mjs --merge-group # skip leg (c) (serial queue)
 *
 * Exit 0 = no collision. Exit 1 = one or more refusals printed.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { gitEnv } from './_git-env-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const LEGACY_REL = 'chaingraph/graph/RESERVATIONS.json'
const SHARD_DIR_REL = 'chaingraph/graph/reservations'
const RESERVATIONS_PATH = resolve(REPO, LEGACY_REL)
const SHARD_DIR = resolve(REPO, SHARD_DIR_REL)
const SHARD_FILE_RE = /^(art-\d+)\.json$/

const argv = process.argv.slice(2)
const MERGE_GROUP = argv.includes('--merge-group')
const IN_MERGE_GROUP = isMergeGroupRun({ flag: MERGE_GROUP, eventName: process.env.GITHUB_EVENT_NAME || '', refName: process.env.GITHUB_REF_NAME || '' })

// Both spellings, art-<n>-slug and bare <n>-slug, match; capture 1 stays the
// bare number so every id stays keyed art-<n> exactly as before
// (ID-COLLISION-BARE-PREFIX-1; bare spellings: legacy 503..515 plus the
// 2026-10/11 bare landings the art-only match never saw).
const NODE_RE = /^chaingraph\/graph\/nodes\/(?:art-)?(\d+)-[^/]+\.json$/
const MANIFEST_RE = /^manifests\/(?:art-)?(\d+)-[^/]+\.manifest\.json$/
const TOOL_RE = /^tools\/(\d+)-[^/]+\.html$/

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv(), ...opts })
}

function gitOk(args) {
  try { git(args); return true } catch { return false }
}

/** art id -> paths of that id's kind on origin/main (or null when origin/main unreadable). */
function mainIdPaths() {
  if (!gitOk(['cat-file', '-e', 'origin/main'])) return null // caller refuses closed
  const out = git(['ls-tree', '-r', '--name-only', 'origin/main', 'chaingraph/graph/nodes/', 'manifests/', 'tools/'])
  const byId = new Map()
  for (const p of out.split('\n')) {
    const m = NODE_RE.exec(p) || MANIFEST_RE.exec(p) || TOOL_RE.exec(p)
    if (!m) continue
    const id = `art-${m[1]}`
    if (!byId.has(id)) byId.set(id, [])
    byId.get(id).push(p)
  }
  return byId
}

/**
 * Is this run a merge-queue group build? The queue's checkout is a commit
 * ON TOP OF the entries ahead of this PR, so origin/main...HEAD would also
 * contain their files (a stacked group is the normal case at
 * max_entries_to_build > 1). Pure: driven by --self-test.
 */
export function isMergeGroupRun({ flag = false, eventName = '', refName = '' } = {}) {
  return Boolean(flag) || eventName === 'merge_group' || /^gh-readonly-queue\//.test(refName)
}

/**
 * Pure core: the git range holding ONLY this PR's own changes. pull_request
 * keeps the three-dot range vs origin/main. In a merge group the HEAD commit
 * is this entry's own commit and its first parent is the previous entry (or
 * main), so HEAD^1..HEAD is this PR alone. Fails closed (error, no range)
 * when the PR number or the parent cannot be determined.
 */
export function ownChangeRange({ mergeGroup, prNumber, hasParent }) {
  if (!mergeGroup) return { range: ['origin/main...HEAD'] }
  if (prNumber == null || Number.isNaN(prNumber)) return { error: 'merge_group run but this PR number is undeterminable from PR_ID_COLLISION_PR / GITHUB_REF_NAME' }
  if (!hasParent) return { error: 'merge_group run but HEAD has no first parent to scope this entry own changes' }
  return { range: ['HEAD^1', 'HEAD'] }
}

/** Changed paths of this PR alone (see ownChangeRange). null = undeterminable, caller refuses closed. */
function changedPaths(cwd = REPO, mergeGroup = IN_MERGE_GROUP, prNumber = null) {
  const gitIn = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() })
  let hasParent = false
  try { gitIn(['rev-parse', '--verify', '-q', 'HEAD^1']); hasParent = true } catch { /* no parent */ }
  const r = ownChangeRange({ mergeGroup, prNumber, hasParent })
  if (r.error) { console.error(`check-id-collision: ${r.error} - refusing closed.`); return null }
  const out = gitIn(['diff', '--name-only', ...r.range])
  return out.split('\n').map(s => s.trim()).filter(Boolean)
}

/**
 * Pure core (also driven by --self-test): union of the per-id shards and the
 * legacy object. shards / legacy: { 'art-<n>': entry } (legacy null = file gone).
 * An id in both with different content lands in `mismatches` (leg (b) refuses
 * it for a minted id; --seed-check refuses any).
 */
export function mergeReservations(shards, legacy) {
  const reservations = { ...(legacy || {}) }
  const mismatches = new Set()
  for (const [id, entry] of Object.entries(shards)) {
    if (legacy && legacy[id] && !isDeepStrictEqual(legacy[id], entry)) mismatches.add(id)
    reservations[id] = entry // the shard wins for display; the mismatch still refuses
  }
  return { reservations, mismatches }
}

/** Working-tree shards: { id: entry }. Non-shard file names are ignored; bad JSON throws (refuse closed). */
function loadShards() {
  const out = {}
  if (!existsSync(SHARD_DIR)) return out
  for (const f of readdirSync(SHARD_DIR)) {
    const m = SHARD_FILE_RE.exec(f)
    if (!m) continue
    out[m[1]] = JSON.parse(readFileSync(join(SHARD_DIR, f), 'utf8'))
  }
  return out
}

function loadReservations() {
  const legacy = existsSync(RESERVATIONS_PATH) ? JSON.parse(readFileSync(RESERVATIONS_PATH, 'utf8')) : null
  return { ...mergeReservations(loadShards(), legacy), legacy }
}

/**
 * Pure core (also driven by --self-test): all refusals for one claimed id.
 * kind: 'node' | 'manifest' | 'tool'
 * mainPaths: Map id -> string[] (paths on main) | null (main unreadable)
 * openPrs: [{number,title}] of open PRs | null (leg (c) unavailable)
 */
/**
 * A pr=null reservation belongs to THIS PR when the PR itself added the line
 * (mainReservations = origin/main's registry; null = unreadable, never owned
 * by that leg) or the reserving row is this PR's head branch name.
 */
export function ownsNullPrReservation({ id, res, mainReservations, headRef }) {
  if (mainReservations && !mainReservations[id]) return true
  return Boolean(headRef && res.row && headRef.split('/').pop() === res.row)
}

export function checkId({ id, kind, path, mainPaths, reservations, openPrs, prNumber, mainReservations = null, headRef = null, mismatches = null }) {
  const refusals = []
  const onMain = mainPaths?.get(id) ?? []

  // (a) id already used on main by a different path (a same-path hit is a
  // modification of the PR's own main shard, not a mint).
  const otherOnMain = onMain.filter(p => p !== path)
  if (otherOnMain.length > 0) {
    refusals.push(`REFUSAL(a) main-collision: ${id} (${kind}) is already on origin/main at ` +
      otherOnMain.join(', ') + ` — this PR (${path}) is minting a used id. Renumber: next free id = ` +
      `max(main shards, reservations, open PRs) + 1, and reserve it BEFORE the first kernel byte.`)
  }

  // (b) reservation registry: must exist and map to this row/PR.
  const res = reservations[id]
  if (!res) {
    refusals.push(`REFUSAL(b) missing-reservation: ${id} (${kind}, ${path}) has no reservation. ` +
      `Every node-minting PR MUST add its own file ${SHARD_DIR_REL}/${id}.json ` +
      `({"row":..., "pr":..., "reserved":...}) — the file is the lock; ` +
      `two PRs reserving the same id add/add-conflict on it in the merge queue.`)
  } else if (mismatches?.has(id)) {
    refusals.push(`REFUSAL(b) legacy-shard-mismatch: ${id} (${kind}) has different entries in ` +
      `${SHARD_DIR_REL}/${id}.json and legacy ${LEGACY_REL} — one lock, two answers. ` +
      `Edit only the shard file and leave the legacy line as main has it.`)
  } else if (prNumber != null && res.pr == null && ownsNullPrReservation({ id, res, mainReservations, headRef })) {
    // A row reserves its id before its PR exists, so
    // the line usually carries pr=null. That is this PR's own lock when the
    // line is new in this PR (absent from origin/main's registry: git conflict
    // on the line is still the mechanical collision check) or its row names
    // this PR's head branch. 26 false refusals over 10-01..10-29 were this shape.
  } else if (prNumber != null && res.pr !== prNumber) {
    refusals.push(`REFUSAL(b) reservation-mismatch: ${id} (${kind}) is reserved in ` +
      `the registry to pr=${res.pr} (row "${res.row}"), but this PR is #${prNumber}. ` +
      `Two PRs claiming one id — the newer renumbers.`)
  }

  // (c) another OPEN PR already claims the id (skipped on merge_group: serial queue).
  if (openPrs) {
    const others = openPrs.filter(p => p.number !== prNumber)
    for (const p of others) {
      refusals.push(`REFUSAL(c) open-PR-collision: ${id} (${kind}) is already claimed by open PR ` +
        `#${p.number} "${p.title}". Renumber this PR; next free id = ` +
        `max(main shards, reservations, open PRs) + 1.`)
    }
  }

  return refusals
}

/**
 * Pure core for one NEW changed file (absent from origin/main; the caller
 * precomputes that with `git cat-file -e` and only NEW files reach here).
 * Also driven by --self-test (ID-COLLISION-BACKFILL-1).
 *
 * BACKFILL, not a mint: a NEW file whose id already owns another surface on
 * main (its node shard, page or tool page, per mainPaths) completes an existing
 * id — e.g. the manifest a node landed without (CONTRACT §2.7). It is counted
 * and NOT refused; legs (a)/(b)/(c) are not consulted. A NEW file for an id
 * with NO surface on main stays a mint and goes through checkId exactly as
 * before.
 */
export function checkNewPath({ id, path, mainPaths, reservations, openPrs, prNumber, mainReservations = null, headRef = null, mismatches = null }) {
  if ((mainPaths?.get(id) ?? []).length > 0) return { backfill: true, refusals: [] }
  const kind = NODE_RE.test(path) ? 'node' : MANIFEST_RE.test(path) ? 'manifest' : 'tool'
  return { backfill: false, refusals: checkId({ id, kind, path, mainPaths, reservations, openPrs, prNumber, mainReservations, headRef, mismatches }) }
}

/**
 * origin/main's registry (shards ∪ legacy), or null when unreadable (the
 * new-in-PR leg then never fires). Only id PRESENCE is consulted
 * (ownsNullPrReservation), so shard ids come from one ls-tree, not N blob reads.
 */
function loadMainReservations() {
  let legacy = null
  try { legacy = JSON.parse(git(['show', `origin/main:${LEGACY_REL}`])) } catch { /* gone or unreadable */ }
  let names
  try { names = git(['ls-tree', '--name-only', `origin/main:${SHARD_DIR_REL}`]) } catch { names = null }
  if (!legacy && names == null) return null
  const out = { ...(legacy || {}) }
  for (const f of (names || '').split('\n')) {
    const m = SHARD_FILE_RE.exec(f.trim())
    if (m && !out[m[1]]) out[m[1]] = { shard: true }
  }
  return out
}

/** Which open PRs claim `id` (exact token match, not substring). null = leg unavailable. */
function openPrsClaiming(id) {
  const tokenRe = new RegExp(`\\b${id}\\b`)
  let out
  try {
    out = execFileSync('gh', ['pr', 'list', '-R', 'PostOakLabs/ainumbers', '--state', 'open',
      '--json', 'number,title'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    return null // named skip at the call site (SO #34c: absence reported, never silent)
  }
  let parsed
  try { parsed = JSON.parse(out) } catch { return null }
  return parsed.filter(p => tokenRe.test(p.title))
}

/** This PR's number from the CI environment (pull_request ref or merge-group queue name). */
function thisPrNumber() {
  if (process.env.PR_ID_COLLISION_PR) return Number(process.env.PR_ID_COLLISION_PR)
  const refName = process.env.GITHUB_REF_NAME || ''
  let m = /^(\d+)\/merge$/.exec(refName)
  if (m) return Number(m[1])
  m = /pr-(\d+)-/.exec(refName) // gh-readonly-queue/main/pr-<n>-<sha>
  if (m) return Number(m[1])
  return null
}

// ---------------------------------------------------------------- self-test
export function selfTest() {
  const results = []
  const expectRed = (name, refusals, cls) => {
    // the named refusal class must be among the refusals (multiple classes may fire on one fixture)
    const ok = refusals.some(r => r.includes(`REFUSAL(${cls})`))
    results.push({ name, ok, quote: refusals.find(r => r.includes(`REFUSAL(${cls})`)) || '(no refusal — UNEXPECTED GREEN)' })
  }
  const expectGreen = (name, refusals) => {
    results.push({ name, ok: refusals.length === 0, quote: refusals[0] || 'GREEN: no refusal' })
  }

  const mainPaths = new Map([
    ['art-686', ['chaingraph/graph/nodes/art-686-ltc-funding-comparator.json', 'tools/686-ltc-funding-comparator.html']],
    ['art-687', ['chaingraph/graph/nodes/art-687-wash-sale-window-guard.json']],
  ])
  const reservations = {
    'art-686': { row: 'LTC-COMPARATOR-BUILD-1', pr: 1759, reserved: '2026-09-06T01:20:00Z' },
    'art-687': { row: 'EDUCATION-FUNDING-BUILD-1', pr: 1758, reserved: '2026-09-06T02:59:00Z' },
    'art-688': { row: 'HARVEST-GUARD-BUILD-1', pr: 1748, reserved: '2026-09-06T01:30:00Z' },
    'art-685': { row: 'DIRECT-INDEXING-FIT-BUILD-1', pr: 1749, reserved: '2026-09-06T00:30:00Z' },
  }
  const openPrs = [{ number: 1749, title: 'art-685 direct-indexing-fit-screen: kernel + node + page' }]

  // RED (a): fixture PR reuses an id main already has (#1759-minted art-686 replay).
  expectRed('RED(a) id already on main',
    checkId({ id: 'art-686', kind: 'node', path: 'chaingraph/graph/nodes/art-686-education-funding-gap-calculator.json', mainPaths, reservations, openPrs: null, prNumber: 1748 }),
    'a')

  // RED (b): fixture PR mints a fresh id with NO reservation line.
  expectRed('RED(b) missing reservation',
    checkId({ id: 'art-690', kind: 'node', path: 'chaingraph/graph/nodes/art-690-foo.json', mainPaths, reservations, openPrs: null, prNumber: 1762 }),
    'b')

  // RED (b2): reservation maps to a DIFFERENT row/PR (art-688 reserved, second PR claims it).
  expectRed('RED(b) reservation maps to another PR',
    checkId({ id: 'art-688', kind: 'node', path: 'chaingraph/graph/nodes/art-688-foo.json', mainPaths, reservations, openPrs: null, prNumber: 1762 }),
    'b')

  // RED (c): another OPEN PR already claims the id (#1749 replay). openPrs here is the
  // pre-filtered claim list for THIS id (the same shape runDiff feeds the core).
  expectRed('RED(c) another open PR claims the id',
    checkId({ id: 'art-685', kind: 'node', path: 'chaingraph/graph/nodes/art-685-bar.json', mainPaths, reservations, openPrs, prNumber: 1762 }),
    'c')

  // GREEN: correct line — fresh id, own reservation, no open-PR claim.
  expectGreen('GREEN correct reservation line',
    checkId({ id: 'art-690', kind: 'node', path: 'chaingraph/graph/nodes/art-690-bar.json', mainPaths, reservations: { ...reservations, 'art-690': { row: 'THIS-ROW-1', pr: 1762, reserved: '2026-09-06T02:00:00Z' } }, openPrs: [], prNumber: 1762 }))

  // GREEN: modifying your own main shard is not a mint.
  expectGreen('GREEN modification of own main shard',
    checkId({ id: 'art-687', kind: 'node', path: 'chaingraph/graph/nodes/art-687-wash-sale-window-guard.json', mainPaths, reservations, openPrs: [], prNumber: 1758 }))

  // BACKFILL vs MINT (ID-COLLISION-BACKFILL-1): a manifest ADDED for an id whose
  // node shard is already on main (the #2133/#2197 shape: the node landed
  // without its manifest) is a backfill of an existing id — OK, counted — not a
  // mint refused as "minting a used id" (the REFUSAL that parked #2197).
  const bf = checkNewPath({ id: 'art-686', path: 'manifests/art-686-ltc-funding-comparator.manifest.json',
    mainPaths, reservations, openPrs: [], prNumber: 2197 })
  results.push({ name: 'GREEN backfill: manifest added for an id whose node shard is on main',
    ok: bf.backfill === true && bf.refusals.length === 0,
    quote: bf.refusals[0] || 'GREEN: backfill of existing id art-686, no refusal' })

  // The mint path is unchanged: a manifest ADDED for an id with NO surface on
  // main and a reservation held by ANOTHER PR is still a mint — refused (b).
  const mint = checkNewPath({ id: 'art-688', path: 'manifests/art-688-harvest-guard.manifest.json',
    mainPaths, reservations, openPrs: null, prNumber: 1762 })
  results.push({ name: 'RED(b) manifest mint: no surface on main, foreign reservation',
    ok: mint.backfill === false && mint.refusals.some(r => r.includes('REFUSAL(b)')),
    quote: mint.refusals.find(r => r.includes('REFUSAL(b)')) || '(no refusal — UNEXPECTED GREEN)' })

  // STACKED MERGE GROUP: the group tree carries earlier entries' files; only
  // this entry's own commit (HEAD^1..HEAD) is checked.
  const stack = stackedGroupFixture()
  results.push({ name: 'GREEN stacked merge_group: id reserved to an earlier entry (art-770, pr=2524) is not this PR change',
    ok: stack.ownPaths !== null && stack.ownPaths.length === 1 && stack.ownPaths[0] === 'scripts/sync.mjs',
    quote: `own paths: ${JSON.stringify(stack.ownPaths)}` })
  expectGreen('GREEN stacked merge_group: no node file in own range, no refusal', (stack.ownPaths || ['<null>']).filter(p => NODE_RE.test(p) || p === '<null>'))
  results.push({ name: 'CONTROL pull_request three-dot range still sees the whole tree (earlier entry file included)',
    ok: stack.wholeIncludesEarlier === true, quote: `whole range has earlier entry file: ${stack.wholeIncludesEarlier}` })
  expectRed('RED merge_group: the current PR OWN minted id reserved to another PR still refuses',
    checkId({ id: 'art-770', kind: 'node', path: 'chaingraph/graph/nodes/art-770-foo.json', mainPaths, reservations: { ...reservations, 'art-770': { row: 'OTHER-1', pr: 2524, reserved: '2026-11-07T00:00:00Z' } }, openPrs: null, prNumber: 2948 }),
    'b')
  const noPr = ownChangeRange({ mergeGroup: true, prNumber: null, hasParent: true })
  const noParent = ownChangeRange({ mergeGroup: true, prNumber: 2948, hasParent: false })
  results.push({ name: 'RED merge_group undeterminable (no PR number / no parent) fails closed',
    ok: Boolean(noPr.error) && Boolean(noParent.error) && !noPr.range && !noParent.range,
    quote: noPr.error || '(no error - UNEXPECTED GREEN)' })
  results.push({ name: 'GREEN pull_request range unchanged (origin/main...HEAD)',
    ok: ownChangeRange({ mergeGroup: false, prNumber: null, hasParent: false }).range?.join(' ') === 'origin/main...HEAD',
    quote: 'origin/main...HEAD' })
  results.push({ name: 'GREEN merge_group detection (flag, event, queue ref); a pull_request ref is not mis-detected',
    ok: isMergeGroupRun({ eventName: 'merge_group' }) && isMergeGroupRun({ refName: 'gh-readonly-queue/main/pr-2948-abc' }) && isMergeGroupRun({ flag: true }) && !isMergeGroupRun({ eventName: 'pull_request', refName: '2948/merge' }),
    quote: 'detection ok' })

  // pr=null reservations (a row reserves before its PR exists).
  const nullRes = { ...reservations, 'art-780': { row: 'SOLANA-PDA-ATA-AUDIT-1', pr: null, reserved: '2026-10-29T02:00:00Z' } }
  // GREEN: the PR added the pr=null line itself (absent from main's registry) — the #2727 shape.
  expectGreen('GREEN pr=null reservation added by this PR',
    checkId({ id: 'art-780', kind: 'node', path: 'chaingraph/graph/nodes/art-780-foo.json', mainPaths, reservations: nullRes,
      openPrs: [], prNumber: 2727, mainReservations: reservations }))
  // GREEN: pr=null line already on main, its row is this PR's head branch.
  expectGreen('GREEN pr=null reservation on main, row = head branch',
    checkId({ id: 'art-780', kind: 'node', path: 'chaingraph/graph/nodes/art-780-foo.json', mainPaths, reservations: nullRes,
      openPrs: [], prNumber: 2727, mainReservations: nullRes, headRef: 'SOLANA-PDA-ATA-AUDIT-1' }))
  // RED: pr=null line already on main for ANOTHER row — still someone else's lock.
  expectRed('RED(b) pr=null reservation on main held by another row',
    checkId({ id: 'art-780', kind: 'node', path: 'chaingraph/graph/nodes/art-780-foo.json', mainPaths, reservations: nullRes,
      openPrs: null, prNumber: 2730, mainReservations: nullRes, headRef: 'OTHER-ROW-1' }),
    'b')
  // RED: main's registry unreadable and no row match — fail closed.
  expectRed('RED(b) pr=null reservation, main registry unreadable, no row match',
    checkId({ id: 'art-780', kind: 'node', path: 'chaingraph/graph/nodes/art-780-foo.json', mainPaths, reservations: nullRes,
      openPrs: null, prNumber: 2730, mainReservations: null, headRef: null }),
    'b')

  // RESERVATIONS-SHARD-1: shards ∪ legacy union.
  const mine = { row: 'THIS-ROW-1', pr: 1762, reserved: '2026-11-03T01:00:00Z' }
  // GREEN: id only in the legacy object (a PR opened before the split) still counts.
  const legacyOnly = mergeReservations({}, { ...reservations, 'art-790': mine })
  expectGreen('GREEN legacy-only id (pre-split PR) counts as reserved',
    checkId({ id: 'art-790', kind: 'node', path: 'chaingraph/graph/nodes/art-790-foo.json', mainPaths,
      ...legacyOnly, openPrs: [], prNumber: 1762 }))
  // GREEN: id only in a shard (the new layout).
  const shardOnly = mergeReservations({ 'art-790': mine }, reservations)
  expectGreen('GREEN shard-only id (new layout)',
    checkId({ id: 'art-790', kind: 'node', path: 'chaingraph/graph/nodes/art-790-foo.json', mainPaths,
      ...shardOnly, openPrs: [], prNumber: 1762 }))
  // GREEN: migrated id, shard equal to its legacy entry.
  const migrated = mergeReservations({ 'art-790': { ...mine } }, { ...reservations, 'art-790': mine })
  expectGreen('GREEN migrated id (shard equals legacy entry)',
    checkId({ id: 'art-790', kind: 'node', path: 'chaingraph/graph/nodes/art-790-foo.json', mainPaths,
      ...migrated, openPrs: [], prNumber: 1762 }))
  // RED: one id, two answers (legacy says #1800, shard says #1762).
  const split = mergeReservations({ 'art-790': mine }, { ...reservations, 'art-790': { ...mine, pr: 1800 } })
  expectRed('RED(b) legacy vs shard mismatch for one id',
    checkId({ id: 'art-790', kind: 'node', path: 'chaingraph/graph/nodes/art-790-foo.json', mainPaths,
      ...split, openPrs: null, prNumber: 1762 }),
    'b')

  // BARE-NUMBER SPELLING (ID-COLLISION-BARE-PREFIX-1): a bare shard
  // (nodes/790-foo.json, no art- prefix) must clear the same legs an art-
  // shard clears, keyed to the same art-<n> id. The driver replays runDiff's
  // per-changed-path step (regex -> id -> checkNewPath); `unseen` is the hole
  // this row closes: under the old art-only regex the path never matched, so
  // the id was silently never checked.
  const bareChanged = (path, { res = reservations, open = null, main = mainPaths } = {}) => {
    const m = NODE_RE.exec(path) || MANIFEST_RE.exec(path)
    if (!m) return { unseen: true, refusals: [], backfill: false }
    return { unseen: false, ...checkNewPath({ id: `art-${m[1]}`, path, mainPaths: main, reservations: res, openPrs: open, prNumber: 1762 }) }
  }
  // (i) bare node shard added with no reservation -> REFUSAL(b), not silence.
  const bi = bareChanged('chaingraph/graph/nodes/790-foo.json')
  results.push({ name: 'RED(b) bare-number node shard, no reservation (was silently unchecked)',
    ok: bi.unseen === false && bi.refusals.some(r => r.includes('REFUSAL(b)')),
    quote: bi.unseen ? '(never checked - bare path unseen by the art-only regex: silence, not a refusal)'
      : bi.refusals.find(r => r.includes('REFUSAL(b)')) || '(no refusal - UNEXPECTED GREEN)' })
  // (ii) bare shard whose id another open PR already claims -> REFUSAL(c).
  const bii = bareChanged('chaingraph/graph/nodes/791-foo.json', {
    res: { ...reservations, 'art-791': { row: 'BARE-PREFIX-ROW-1', pr: 1762, reserved: '2026-11-07T00:00:00Z' } },
    open: [{ number: 2769, title: '791 bare-claim: kernel + node + page' }] })
  results.push({ name: 'RED(c) bare-number shard whose id another open PR claims',
    ok: bii.unseen === false && bii.refusals.some(r => r.includes('REFUSAL(c)')),
    quote: bii.unseen ? '(never checked - bare path unseen by the art-only regex: silence, not a refusal)'
      : bii.refusals.find(r => r.includes('REFUSAL(c)')) || '(no refusal - UNEXPECTED GREEN)' })
  // (iii) bare shard with a matching reservation for THIS PR -> checked and OK.
  const biii = bareChanged('chaingraph/graph/nodes/792-foo.json', {
    res: { ...reservations, 'art-792': { row: 'BARE-PREFIX-ROW-1', pr: 1762, reserved: '2026-11-07T00:00:00Z' } },
    open: [] })
  results.push({ name: 'GREEN bare-number shard with this PR\'s own reservation',
    ok: biii.unseen === false && biii.refusals.length === 0,
    quote: biii.unseen ? '(never checked - bare path unseen by the art-only regex: silence, not green)'
      : biii.refusals[0] || 'GREEN: bare shard checked, own reservation, no refusal' })
  // (iv) bare manifest backfill for an id whose (bare) node shard is on main -> OK backfill.
  const bareMain = new Map([...mainPaths, ['art-793', ['chaingraph/graph/nodes/793-legacy-bare-node.json']]])
  const biv = bareChanged('manifests/793-legacy-bare-node.manifest.json', { main: bareMain })
  results.push({ name: 'GREEN bare-number manifest backfill (bare node of the same id on main)',
    ok: biv.unseen === false && biv.backfill === true && biv.refusals.length === 0,
    quote: biv.unseen ? '(never checked - bare path unseen by the art-only regex: silence, not green)'
      : biv.refusals[0] || 'GREEN: backfill of existing id art-793, no refusal' })

  // The lock itself is a git property, so prove it with git: a throwaway repo,
  // two branches off one base, `git merge-tree --write-tree` (exit 1 = conflict).
  const lock = mergeTreeFixtures()
  if (lock.error) {
    results.push({ name: 'git lock fixtures', ok: false, quote: `sandbox git failed: ${lock.error}` })
  } else {
    results.push({ name: 'RED same id reserved in two shards (two PRs, art-790.json each) → add/add conflict',
      ok: lock.sameId === true, quote: lock.sameId ? `merge-tree CONFLICT: ${lock.sameIdMsg}` : '(merged clean — UNEXPECTED GREEN, the lock is gone)' })
    results.push({ name: 'GREEN different ids in two shards (art-790.json vs art-791.json) → clean merge',
      ok: lock.diffIds === false, quote: lock.diffIds ? `(merge-tree CONFLICT — UNEXPECTED RED: ${lock.diffIdsMsg})` : 'GREEN: merge-tree clean' })
    results.push({ name: 'CONTROL legacy single-object layout, different ids → still conflicts (why the split exists)',
      ok: lock.legacyDiffIds === true, quote: lock.legacyDiffIds ? `merge-tree CONFLICT: ${lock.legacyDiffIdsMsg}` : '(merged clean — control did not reproduce)' })
  }

  let failed = 0
  for (const r of results) {
    console.error(`  ${r.ok ? 'ok' : 'FAIL'} — ${r.name}`)
    console.error(`      ${r.quote}`)
    if (!r.ok) failed++
  }
  console.error(`check-id-collision --self-test: ${results.length - failed}/${results.length} fixtures as expected`)
  return failed === 0
}

/**
 * Throwaway repo: base, then an earlier queue entry (adds a node file), then
 * this entry (adds a script). Returns the own-range paths and whether the
 * pull_request-style whole range would also include the earlier entry's file.
 */
function stackedGroupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'idcoll-stack-'))
  const sg = (args) => execFileSync('git', ['-c', 'user.name=selftest', '-c', 'user.email=selftest@invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() })
  try {
    sg(['init', '-q', '-b', 'main'])
    writeFileSync(join(dir, 'base.txt'), 'base\n'); sg(['add', '.']); sg(['commit', '-q', '-m', 'base'])
    sg(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    mkdirSync(join(dir, 'chaingraph/graph/nodes'), { recursive: true })
    writeFileSync(join(dir, 'chaingraph/graph/nodes/art-770-earlier.json'), '{}\n'); sg(['add', '.']); sg(['commit', '-q', '-m', 'earlier entry (#2524)'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts/sync.mjs'), '//\n'); sg(['add', '.']); sg(['commit', '-q', '-m', 'this entry (#2948)'])
    const ownPaths = changedPaths(dir, true, 2948)
    const whole = sg(['diff', '--name-only', 'origin/main...HEAD']).split('\n')
    return { ownPaths, wholeIncludesEarlier: whole.includes('chaingraph/graph/nodes/art-770-earlier.json') }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

/**
 * Throwaway-repo merge-tree proof of the lock (self-test only). Every git call
 * runs with gitEnv() and cwd = the sandbox, so a hook-leaked GIT_DIR cannot
 * point it at the real repository. Returns { sameId, diffIds, legacyDiffIds }
 * as booleans (true = conflict) plus the conflict lines, or { error }.
 */
function mergeTreeFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'idcoll-lock-'))
  const sg = (args) => execFileSync('git', ['-c', 'user.name=selftest', '-c', 'user.email=selftest@invalid',
    '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${join(dir, '.nohooks')}`, '-c', 'core.autocrlf=false', ...args],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() })
  const put = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text) }
  const entry = (row, pr) => JSON.stringify({ row, pr, reserved: '2026-11-03T01:00:00Z' }, null, 2) + '\n'
  const legacyText = (obj) => JSON.stringify(obj, null, 2) + '\n'
  const base = { 'art-788': { row: 'BASE-1', pr: null, reserved: '2026-11-01T00:00:00Z' } }
  const branch = (name, files) => {
    sg(['checkout', '-q', '-b', name, 'main'])
    for (const [rel, text] of Object.entries(files)) put(rel, text)
    sg(['add', '-A']); sg(['commit', '-q', '-m', name])
  }
  const conflicts = (a, b) => {
    try { sg(['merge-tree', '--write-tree', '--name-only', a, b]); return { c: false, msg: '' } } catch (e) {
      if (e.status !== 1) throw e
      const lines = String(e.stdout || '').split('\n').filter(l => /CONFLICT/.test(l))
      return { c: true, msg: lines.join(' | ') || 'exit 1' }
    }
  }
  try {
    sg(['init', '-q', '-b', 'main'])
    put('chaingraph/graph/RESERVATIONS.json', legacyText(base))
    put('chaingraph/graph/reservations/art-788.json', entry('BASE-1', null))
    sg(['add', '-A']); sg(['commit', '-q', '-m', 'base'])
    const S = 'chaingraph/graph/reservations/'
    branch('pr-a-same', { [`${S}art-790.json`]: entry('ROW-A-1', 2001) })
    branch('pr-b-same', { [`${S}art-790.json`]: entry('ROW-B-1', 2002) })
    branch('pr-a-diff', { [`${S}art-790.json`]: entry('ROW-A-1', 2001) })
    branch('pr-b-diff', { [`${S}art-791.json`]: entry('ROW-B-1', 2002) })
    branch('legacy-a', { 'chaingraph/graph/RESERVATIONS.json': legacyText({ ...base, 'art-790': { row: 'ROW-A-1', pr: 2001, reserved: '2026-11-03T01:00:00Z' } }) })
    branch('legacy-b', { 'chaingraph/graph/RESERVATIONS.json': legacyText({ ...base, 'art-791': { row: 'ROW-B-1', pr: 2002, reserved: '2026-11-03T01:00:00Z' } }) })
    const same = conflicts('pr-a-same', 'pr-b-same')
    const diff = conflicts('pr-a-diff', 'pr-b-diff')
    const leg = conflicts('legacy-a', 'legacy-b')
    return { sameId: same.c, sameIdMsg: same.msg, diffIds: diff.c, diffIdsMsg: diff.msg, legacyDiffIds: leg.c, legacyDiffIdsMsg: leg.msg }
  } catch (e) {
    return { error: String(e.stderr || e.message).trim().split('\n')[0] }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ------------------------------------------------------------------- modes
function runSeedCheck() {
  const mainPaths = mainIdPaths()
  if (!mainPaths) { console.error('check-id-collision: origin/main unreadable — cannot seed-check (fail closed).'); process.exit(1) }
  let loaded
  try { loaded = loadReservations() } catch (e) {
    console.error(`check-id-collision --seed-check: registry unreadable (${e.message}) — fail closed.`); process.exit(1)
  }
  const { reservations, mismatches, legacy } = loaded
  const shardIds = [...mainPaths.keys()].filter(id =>
    mainPaths.get(id).some(p => NODE_RE.test(p)))
  const missing = shardIds.filter(id => !reservations[id])
  for (const id of missing) console.error(`  seed-check: main node shard ${id} has no reservation (${SHARD_DIR_REL}/ or legacy)`)
  for (const id of mismatches) console.error(`  seed-check: ${id} differs between ${SHARD_DIR_REL}/${id}.json and legacy ${LEGACY_REL}`)
  const total = Object.keys(reservations).length
  const shardCount = Object.keys(loadShards()).length
  const legacyOnly = legacy ? Object.keys(legacy).filter(id => !existsSync(join(SHARD_DIR, `${id}.json`))).length : 0
  console.error(`check-id-collision --seed-check: reservations=${total} (shards=${shardCount}, ` +
    `legacy=${legacy ? Object.keys(legacy).length : 'absent'}, legacy-only=${legacyOnly}, mismatches=${mismatches.size}) ` +
    `main node shards=${shardIds.length} extras=${total - shardIds.length}` +
    (missing.length + mismatches.size === 0 ? ' — seeded OK' : ''))
  process.exit(missing.length + mismatches.size === 0 ? 0 : 1)
}

function runDiff() {
  const mainPaths = mainIdPaths()
  if (!mainPaths) { console.error('check-id-collision: origin/main unreadable — refusing closed (a diff-scoped collision gate on a stale checkout is a silent green).'); process.exit(1) }
  let reservations, mismatches, legacy
  try { ({ reservations, mismatches, legacy } = loadReservations()) } catch (e) {
    console.error(`check-id-collision: reservation registry unreadable (${e.message}) — refusing closed.`); process.exit(1)
  }
  const prNumber = thisPrNumber()
  const mainReservations = loadMainReservations()
  // New reservations belong in the directory. A legacy line this PR added is
  // still honoured (pre-split PRs must stay green) but named, never silent.
  if (legacy && mainReservations) {
    for (const id of Object.keys(legacy)) {
      if (!mainReservations[id] && !existsSync(join(SHARD_DIR, `${id}.json`))) {
        console.error(`check-id-collision: NOTE ${id} is reserved only in legacy ${LEGACY_REL} — ` +
          `honoured for back-compat; new reservations go to ${SHARD_DIR_REL}/${id}.json (RESERVATIONS-SHARD-1).`)
      }
    }
  }
  const headRef = process.env.GITHUB_HEAD_REF || null
  const own = changedPaths(REPO, IN_MERGE_GROUP, prNumber)
  if (own === null) process.exit(1)
  const changed = own.filter(p => NODE_RE.test(p) || MANIFEST_RE.test(p) || TOOL_RE.test(p))

  // Exact-token open-PR scan, one gh call, only when there is something to check.
  const needIds = new Set()
  for (const p of changed) {
    const m = NODE_RE.exec(p) || MANIFEST_RE.exec(p) || TOOL_RE.exec(p)
    if (!m || gitOk(['cat-file', '-e', `origin/main:${p}`])) continue
    const id = `art-${m[1]}`
    if ((mainPaths.get(id) ?? []).length > 0) continue // backfill of an existing id — leg (c) scans newly minted ids only
    needIds.add(id)
  }
  const openByid = new Map()
  let ghSkipped = false
  if (!MERGE_GROUP && needIds.size > 0) {
    let allOpen
    try {
      const out = execFileSync('gh', ['pr', 'list', '-R', 'PostOakLabs/ainumbers', '--state', 'open',
        '--json', 'number,title'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      allOpen = JSON.parse(out)
    } catch {
      ghSkipped = true
    }
    if (allOpen) {
      for (const id of needIds) {
        const tokenRe = new RegExp(`\\b${id}\\b`)
        openByid.set(id, allOpen.filter(p => tokenRe.test(p.title)))
      }
    }
  }

  const refusals = []
  let backfills = 0
  for (const p of changed) {
    const m = NODE_RE.exec(p) || MANIFEST_RE.exec(p) || TOOL_RE.exec(p)
    if (!m) continue
    const isNew = !gitOk(['cat-file', '-e', `origin/main:${p}`])
    if (!isNew) continue // modification of an existing main file: not a mint
    const id = `art-${m[1]}`
    const out = checkNewPath({ id, path: p, mainPaths, reservations,
      openPrs: openByid.get(id) ?? (MERGE_GROUP ? null : (ghSkipped ? null : [])), prNumber,
      mainReservations, headRef, mismatches })
    if (out.backfill) backfills++ // backfill of an existing id: not a mint, no refusal
    refusals.push(...out.refusals)
  }

  if (ghSkipped && needIds.size > 0) {
    console.error('check-id-collision: leg (c) open-PR scan SKIPPED — gh unavailable/unauthed in this environment. ' +
      'SO #34c: this is a NAMED absence, not a pass; legs (a)+(b) were enforced here and the PR\'s CI run enforces (c).')
  }

  if (refusals.length > 0) {
    console.error(`check-id-collision: FAILED — ${refusals.length} refusal(s):`)
    for (const r of refusals) console.error(`  ${r}`)
    process.exit(1)
  }
  console.error(`check-id-collision: OK — ${changed.length} node/manifest/tool file(s) in diff, ` +
    `${needIds.size} newly minted id(s), ${backfills} backfill(s) of existing id(s), no collision` +
    (MERGE_GROUP ? ' (merge_group: leg (c) skipped, serial queue)' : ''))
}

// ------------------------------------------------------------------- main
if (argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1)
} else if (argv.includes('--seed-check')) {
  runSeedCheck()
} else {
  runDiff()
}
