#!/usr/bin/env node
/**
 * scripts/assemble-land.mjs — automates the manual ASSEMBLE step (CONTRACT A4.0,
 * STANDING ORDER #6): find orphan chaingraph shards on disk that aren't yet in
 * chaingraph.meta.json's order.nodes/order.chains, append them, regenerate
 * chaingraph.json + every stale generator surface, run preflight to green, then
 * print the exact branch/commit/PR + follow-on WORKER VENDOR commands.
 *
 * This is the ORCH-FAST-1 §OF-3 script: it OWNS assemble+regen+preflight+PR-prep.
 * It never touches the worker repo (mcp-apps-poc) and never runs `generate.mjs`
 * or `git push` on the worker side — vendor stays a separate, W-serial step
 * (Tim's ruling, VENDORBATCH-1) run by the ORCH/session after this PR merges.
 *
 * Modes:
 *   node scripts/assemble-land.mjs           # writes meta+chaingraph.json+regen
 *                                             # surfaces, runs preflight to green,
 *                                             # prints branch/commit/PR commands.
 *                                             # Does NOT branch/commit/push/open a
 *                                             # PR itself — those are visible /
 *                                             # irreversible actions left to the
 *                                             # calling session.
 *   node scripts/assemble-land.mjs --dry     # report-only: enumerate orphans,
 *                                             # show what meta.order would become,
 *                                             # and what the assembled
 *                                             # chaingraph.json bytes would be —
 *                                             # writes NOTHING, runs no gates
 */
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NODES_DIR = resolve(REPO, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(REPO, 'chaingraph/graph/chains')
const META_PATH = resolve(REPO, 'chaingraph/chaingraph.meta.json')

const DRY = process.argv.includes('--dry')
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' }

function shardIds(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length))
}

// ---- 1. enumerate orphans mechanically: disk shards vs meta.order (STANDING
// ORDER — never hand-list; the shards on disk are truth, board rows can be stale)
const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
const nodeIdsOnDisk = shardIds(NODES_DIR)
const chainIdsOnDisk = shardIds(CHAINS_DIR)
const orphanNodes = nodeIdsOnDisk.filter((id) => !meta.order.nodes.includes(id))
const orphanChains = chainIdsOnDisk.filter((id) => !meta.order.chains.includes(id))

console.log(`Disk: ${nodeIdsOnDisk.length} node shards, ${chainIdsOnDisk.length} chain shards.`)
console.log(`meta.order: ${meta.order.nodes.length} nodes, ${meta.order.chains.length} chains.`)

if (!orphanNodes.length && !orphanChains.length) {
  console.log('No orphan shards found — chaingraph.json is already current with disk. Nothing to assemble.')
  process.exit(0)
}

console.log(`Orphan nodes (${orphanNodes.length}): ${orphanNodes.join(', ') || '(none)'}`)
console.log(`Orphan chains (${orphanChains.length}): ${orphanChains.join(', ') || '(none)'}`)

function assembledBytes(order) {
  const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare
  const readShard = (dir, id) => {
    const text = readFileSync(resolve(dir, `${id}.json`), 'utf8')
    return text.endsWith('\n') ? text.slice(0, -1) : text
  }
  const joinShards = (texts) => {
    let joined = ''
    texts.forEach((text, i) => { joined += text + (i < texts.length - 1 ? ',\n    ' : '\n  ') })
    return joined
  }
  const sortedNodeIds = [...order.nodes].sort(naturalSort)
  const sortedChainIds = [...order.chains].sort(naturalSort)
  const nodesJoined = joinShards(sortedNodeIds.map((id) => readShard(NODES_DIR, id)))
  const chainsJoined = joinShards(sortedChainIds.map((id) => readShard(CHAINS_DIR, id)))
  return { text: meta.raw.header + nodesJoined + meta.raw.betweenNodesAndChains + chainsJoined + meta.raw.footer, sortedNodeIds, sortedChainIds }
}

if (DRY) {
  // ---- --dry: compute what meta.order + chaingraph.json WOULD become, in
  // memory only. Reuses assemble-chaingraph.mjs's exact join logic so the
  // preview is byte-identical to what a real run would commit.
  const nextOrder = { nodes: [...meta.order.nodes, ...orphanNodes], chains: [...meta.order.chains, ...orphanChains] }
  const { text, sortedNodeIds, sortedChainIds } = assembledBytes(nextOrder)
  console.log(`\n--dry: would append the above to meta.order, then assemble chaingraph.json to ${sortedNodeIds.length} nodes, ${sortedChainIds.length} chains (${text.length} bytes).`)
  console.log('--dry mode: no files written, no gates run, no branch/commit made.')
  process.exit(0)
}

// ---- 2. append orphans to meta.order (append position doesn't matter — CS-2
// re-sorts at assembly time) and write meta.json back
meta.order.nodes.push(...orphanNodes)
meta.order.chains.push(...orphanChains)
writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8')
console.log(`\nAppended ${orphanNodes.length} node id(s) + ${orphanChains.length} chain id(s) to chaingraph.meta.json order.`)

function run(cmd, label) {
  console.log(`\n▶ ${label || cmd}`)
  execSync(cmd, { cwd: REPO, env, stdio: 'inherit' })
}

// ---- 3. regenerate chaingraph.json from shards
run('node scripts/assemble-chaingraph.mjs', 'assemble-chaingraph.mjs')

// ---- 4. run preflight; on a stale-generator failure, run that generator's
// write-mode command and retry. Non-generator failures (real defects) stop
// the script — this only automates the ASSEMBLE residue, not bug-fixing.
const WRITE_OVERRIDES = {
  'node chaingraph/kernels/gen-index.mjs --check': 'node chaingraph/kernels/gen-index.mjs --write',
  'node chaingraph/kernels/gen-kernel-identity.mjs --check': 'node chaingraph/kernels/gen-kernel-identity.mjs --write',
  'node scripts/verify-counts.mjs --check': 'node scripts/verify-counts.mjs --fix',
}

function preflightGates() {
  const src = readFileSync(resolve(REPO, 'scripts/preflight.mjs'), 'utf8')
  const gates = []
  const re = /\[\s*'([^']*)',\s*(?:changedRef[^:]*:\s*)?'([^']*--check[^']*)'/g
  let m
  while ((m = re.exec(src))) gates.push({ label: m[1], checkCmd: m[2] })
  return gates
}

const GATES_BY_LABEL = new Map(preflightGates().map((g) => [g.label, g]))

const MAX_ITERATIONS = 25
let passed = false
for (let i = 0; i < MAX_ITERATIONS; i++) {
  try {
    run('node scripts/preflight.mjs', `preflight.mjs (pass ${i + 1})`)
    console.log('\n✅ preflight PASSED.')
    passed = true
    break
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
    const failedLabelMatch = out.match(/❌ preflight FAILED at: (.+?)\./)
    const failedLabel = failedLabelMatch?.[1]
    const gate = failedLabel ? GATES_BY_LABEL.get(failedLabel) : null
    const writeCmd = gate && (WRITE_OVERRIDES[gate.checkCmd] || gate.checkCmd.replace(' --check', ''))
    if (!gate || !writeCmd || writeCmd === gate.checkCmd) {
      console.error(`\n❌ preflight failed at a non-generator gate ("${failedLabel || 'unknown — see output above'}") — this is a real defect, not stale generated output. Not auto-fixable. Fix it manually, then re-run this script.`)
      process.exit(1)
    }
    console.log(`Stale generated surface detected ("${failedLabel}") — regenerating: ${writeCmd}`)
    run(writeCmd, writeCmd)
  }
}

if (!passed) {
  console.error(`\n❌ Still failing after ${MAX_ITERATIONS} regenerate/retry passes — stopping to avoid a loop. Investigate manually.`)
  process.exit(1)
}

// ---- 5. report the exact next steps. This script stops here: it does NOT
// commit, branch, push, or open a PR on its own (those are visible/irreversible
// actions), and it NEVER touches the worker repo — vendor stays a separate,
// human/session-run, W-serial step.
const branchName = `assemble-land-${new Date().toISOString().slice(0, 10)}`
console.log(`
── ASSEMBLE complete. Next steps (run these yourself / have the session run them) ──

  git checkout -b ${branchName}
  git status   # review every file preflight's regenerators touched
  git add -A
  git commit -m "ASSEMBLE: integrate ${orphanNodes.length} orphan node(s) + ${orphanChains.length} orphan chain(s) into chaingraph.json"
  git push -u origin ${branchName}
  gh pr create --title "ASSEMBLE: ${orphanNodes.length} node(s) + ${orphanChains.length} chain(s)" --body "Orphan shards: ${[...orphanNodes, ...orphanChains].join(', ')}"

── After that PR merges, the FOLLOW-ON WORKER VENDOR (separate, W-serial, run by ORCH/session — NOT this script) ──

  cd mcp-apps-poc
  git pull --rebase
  node mcp-apps-poc/scripts/check-tool-names.mjs
  node generate.mjs
  git add data/ kernels/
  git commit -m "vendor: pick up ${orphanNodes.length + orphanChains.length} newly-assembled shard(s)"
  git push
  # then verify: /mcp initialize 200 + tools/call on the new node(s) with real args
`)
