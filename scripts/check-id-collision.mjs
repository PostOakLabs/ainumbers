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
 *   (b) chaingraph/graph/RESERVATIONS.json carries `art-<id>` mapped to THIS
 *       row/PR (missing, or mapped to a different row/PR, is a refusal). The
 *       registry file is the lock: two PRs reserving the same id conflict on
 *       the same JSON line in the merge queue — git conflict = mechanical
 *       collision detection;
 *   (c) no OTHER open PR already claims the id (token-free: `gh pr list` using
 *       the job's GITHUB_TOKEN; skipped on merge_group — the queue is serial —
 *       and reported, never silent, when gh is unavailable locally; SO #34c:
 *       a skipped leg is named, never a silent green).
 *
 * Same checks apply to tool numbers (tools/<n>-*.html) and node manifests
 * (manifests/art-<n>-*.manifest.json), keyed to the same art-<n> number.
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm/Ajv ever).
 *
 * Usage:
 *   node scripts/check-id-collision.mjs              # diff vs origin/main (CI + local)
 *   node scripts/check-id-collision.mjs --seed-check # RESERVATIONS.json covers every main shard id
 *   node scripts/check-id-collision.mjs --self-test  # RED/GREEN fixture proof (SO #34c)
 *   node scripts/check-id-collision.mjs --merge-group # skip leg (c) (serial queue)
 *
 * Exit 0 = no collision. Exit 1 = one or more refusals printed.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitEnv } from './_git-env-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const RESERVATIONS_PATH = resolve(REPO, 'chaingraph/graph/RESERVATIONS.json')

const argv = process.argv.slice(2)
const MERGE_GROUP = argv.includes('--merge-group')

const NODE_RE = /^chaingraph\/graph\/nodes\/art-(\d+)-[^/]+\.json$/
const MANIFEST_RE = /^manifests\/art-(\d+)-[^/]+\.manifest\.json$/
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

/** Changed paths vs origin/main (three-dot merge-base, same scoping as check-node-complete). */
function changedPaths() {
  const out = git(['diff', '--name-only', 'origin/main...HEAD'])
  return out.split('\n').map(s => s.trim()).filter(Boolean)
}

function loadReservations() {
  return JSON.parse(readFileSync(RESERVATIONS_PATH, 'utf8'))
}

/**
 * Pure core (also driven by --self-test): all refusals for one claimed id.
 * kind: 'node' | 'manifest' | 'tool'
 * mainPaths: Map id -> string[] (paths on main) | null (main unreadable)
 * openPrs: [{number,title}] of open PRs | null (leg (c) unavailable)
 */
export function checkId({ id, kind, path, mainPaths, reservations, openPrs, prNumber }) {
  const refusals = []
  const onMain = mainPaths?.get(id) ?? []

  // (a) id already used on main by a different path (a same-path hit is a
  // modification of the PR's own main shard, not a mint).
  const otherOnMain = onMain.filter(p => p !== path)
  if (otherOnMain.length > 0) {
    refusals.push(`REFUSAL(a) main-collision: ${id} (${kind}) is already on origin/main at ` +
      otherOnMain.join(', ') + ` — this PR (${path}) is minting a used id. Renumber: next free id = ` +
      `max(main shards, RESERVATIONS.json, open PRs) + 1, and reserve it BEFORE the first kernel byte.`)
  }

  // (b) reservation registry: must exist and map to this row/PR.
  const res = reservations[id]
  if (!res) {
    refusals.push(`REFUSAL(b) missing-reservation: ${id} (${kind}, ${path}) has no entry in ` +
      `chaingraph/graph/RESERVATIONS.json. Every node-minting PR MUST add its own line ` +
      `("art-<id>": {"row":..., "pr":..., "reserved":...}) — the registry line is the lock; ` +
      `two PRs reserving the same id conflict on it in the merge queue.`)
  } else if (prNumber != null && res.pr !== prNumber) {
    refusals.push(`REFUSAL(b) reservation-mismatch: ${id} (${kind}) is reserved in ` +
      `RESERVATIONS.json to pr=${res.pr} (row "${res.row}"), but this PR is #${prNumber}. ` +
      `Two PRs claiming one id — the newer renumbers.`)
  }

  // (c) another OPEN PR already claims the id (skipped on merge_group: serial queue).
  if (openPrs) {
    const others = openPrs.filter(p => p.number !== prNumber)
    for (const p of others) {
      refusals.push(`REFUSAL(c) open-PR-collision: ${id} (${kind}) is already claimed by open PR ` +
        `#${p.number} "${p.title}". Renumber this PR; next free id = ` +
        `max(main shards, RESERVATIONS.json, open PRs) + 1.`)
    }
  }

  return refusals
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

  let failed = 0
  for (const r of results) {
    console.error(`  ${r.ok ? 'ok' : 'FAIL'} — ${r.name}`)
    console.error(`      ${r.quote}`)
    if (!r.ok) failed++
  }
  console.error(`check-id-collision --self-test: ${results.length - failed}/${results.length} fixtures as expected`)
  return failed === 0
}

// ------------------------------------------------------------------- modes
function runSeedCheck() {
  const mainPaths = mainIdPaths()
  if (!mainPaths) { console.error('check-id-collision: origin/main unreadable — cannot seed-check (fail closed).'); process.exit(1) }
  const reservations = loadReservations()
  const shardIds = [...mainPaths.keys()].filter(id =>
    mainPaths.get(id).some(p => NODE_RE.test(p)))
  const missing = shardIds.filter(id => !reservations[id])
  for (const id of missing) console.error(`  seed-check: main shard ${id} missing from RESERVATIONS.json`)
  console.error(`check-id-collision --seed-check: reservations=${Object.keys(reservations).length} ` +
    `main node shards=${shardIds.length} extras=${Object.keys(reservations).length - shardIds.length}` +
    (missing.length === 0 ? ' — seeded OK' : ''))
  process.exit(missing.length === 0 ? 0 : 1)
}

function runDiff() {
  const mainPaths = mainIdPaths()
  if (!mainPaths) { console.error('check-id-collision: origin/main unreadable — refusing closed (a diff-scoped collision gate on a stale checkout is a silent green).'); process.exit(1) }
  let reservations
  try { reservations = loadReservations() } catch (e) {
    console.error(`check-id-collision: RESERVATIONS.json unreadable (${e.message}) — refusing closed.`); process.exit(1)
  }
  const prNumber = thisPrNumber()
  const changed = changedPaths().filter(p => NODE_RE.test(p) || MANIFEST_RE.test(p) || TOOL_RE.test(p))

  // Exact-token open-PR scan, one gh call, only when there is something to check.
  const needIds = new Set()
  for (const p of changed) {
    const m = NODE_RE.exec(p) || MANIFEST_RE.exec(p) || TOOL_RE.exec(p)
    if (m && !gitOk(['cat-file', '-e', `origin/main:${p}`])) needIds.add(`art-${m[1]}`)
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
  for (const p of changed) {
    const m = NODE_RE.exec(p) || MANIFEST_RE.exec(p) || TOOL_RE.exec(p)
    if (!m) continue
    const isNew = !gitOk(['cat-file', '-e', `origin/main:${p}`])
    if (!isNew) continue // modification of an existing main file: not a mint
    const id = `art-${m[1]}`
    const kind = NODE_RE.test(p) ? 'node' : MANIFEST_RE.test(p) ? 'manifest' : 'tool'
    refusals.push(...checkId({ id, kind, path: p, mainPaths, reservations,
      openPrs: openByid.get(id) ?? (MERGE_GROUP ? null : (ghSkipped ? null : [])), prNumber }))
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
    `${needIds.size} newly minted id(s), no collision` +
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
