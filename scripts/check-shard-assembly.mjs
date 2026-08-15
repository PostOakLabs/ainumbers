#!/usr/bin/env node
/**
 * scripts/check-shard-assembly.mjs — ASSEMBLE-COVER-1 gate (nodes),
 * extended by CHAINORDER-GATE-1 to cover chain shards too.
 *
 * Detects UNASSEMBLED SHARDS: a file in chaingraph/graph/nodes/*.json whose
 * tool_id, or chaingraph/graph/chains/*.json whose chain name, is absent
 * from the assembled chaingraph/chaingraph.json node/chain set. Node case is
 * the failure class ASSEMBLE-LAND-3 (missed art-386) and ASSEMBLE-LAND-5
 * (missed art-407) both hit. Chain case is CHAINORDER-GATE-1: PACKS-MUNI-1
 * (PR #1062) and PACKS-SEC16-1 (PR #1063) both merged with their chain shard
 * present but absent from chaingraph.meta.json's order.chains, so
 * assemble-chaingraph.mjs never picked them up — every gate stayed green
 * because nothing enumerated chain shard files against the assembled set.
 * Only a later, unrelated land row (PACKS-ASSEMBLE-LAND-2) noticed by
 * chance. This gate closes that: same detection this file already ran for
 * nodes, now run for chains too.
 *
 * NODE-REGISTRATION-GAP-1 (2026-08-15): six kernel-row lands (art-595,
 * art-615, art-616, art-618, art-619, art-620) each wrote a node shard file
 * but never appended its id to chaingraph.meta.json's order.nodes, so
 * assemble-chaingraph.mjs never included them — verify-counts.mjs stayed
 * green throughout because it derives every sentinel FROM chaingraph.json,
 * which agreed with itself while disagreeing with the filesystem. THIS gate
 * is the one that can see that class, so it is now promoted BLOCKING (see
 * switch below) — advisory-only let six nodes leak silently across five
 * separate lands. Also adds the REVERSE direction: a chaingraph.json node
 * whose shard file is missing from disk (registry entry with no backing
 * shard) — previously unchecked; confirmed clean at promotion time but a
 * future hand-edit of chaingraph.json could introduce it.
 *
 * ⚠ Node case is BLOCKING as of NODE-REGISTRATION-GAP-1. Chain case stays
 * ADVISORY (GATE-FREEZE, Tim 2026-07-18) since no chain-leak incident has
 * been measured — a chain shard whose CGSHARD row is mid-flight is EXPECTED
 * to be unassembled, and this gate cannot yet distinguish mid-flight from
 * stale for chains. If a chain-leak incident is ever measured, promote that
 * half the same way node case was promoted here.
 *
 * TO FLIP THE CHAIN CHECK BLOCKING (only once a chain-leak incident is
 * measured): change `const CHAINS_BLOCKING = false` below to `true`. No
 * other code changes needed — it is already wired into preflight.mjs's
 * GATES array.
 *
 * Set diff logic lives in lib-shard-order.mjs (pure, unit-tested against a
 * reproduction of the PACKS-SEC16-1 case — see lib-shard-order.test.mjs) so
 * the same function backs both the node check (unchanged behavior) and the
 * new chain check.
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP).
 *
 * Usage: node scripts/check-shard-assembly.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnlistedShards } from './lib-shard-order.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const NODES_BLOCKING = true // NODE-REGISTRATION-GAP-1: promoted from advisory.
const CHAINS_BLOCKING = false // ← Flip to true once a chain-leak incident is measured.

// NODE-REGISTRATION-GAP-1: explicit, named waiver — NOT a silent baseline. Six
// shards were found unregistered in the sweep that promoted this gate; only 2
// (art-616, art-618) registered clean. The other 4 each trip a DIFFERENT
// non-baselineable hard gate that this row's fence forbids crossing (no
// node-page authoring, no kernel/proving work — see board/done/
// NODE-REGISTRATION-GAP-1.md):
//   - art-615, art-619: catalog-parity.mjs "url page missing on disk" —
//     no chaingraph/<id>.html exists yet.
//   - art-595: FV-COVERAGE-GATE-1 — floor file's kernel_digest_at_authoring
//     no longer matches the live kernel (stale or never-correct digest).
//   - art-620: FV-COVERAGE-GATE-1 — no __proptests__ floor file at all.
// Registration is deferred to whichever row clears its specific blocker;
// remove an entry here the moment that happens and append the id to
// order.nodes for real. A shard NOT in this list is judged exactly as
// before — no widening of the waiver.
const PAGE_BLOCKED_WAIVER = new Set([
  'art-595-ap2-cartmandate-hashchain-builder',
  'art-615-mla-charge-inclusion-classifier',
  'art-619-ccd2-aprc-annex3-recompute',
  'art-620-summa-mst-inclusion-checker',
])

const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(root, 'chaingraph/graph/chains')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')

function shardIdsOnDisk(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort()
}

const nodeShardIds = shardIdsOnDisk(NODES_DIR)
const chainShardIds = shardIdsOnDisk(CHAINS_DIR)

const graph = JSON.parse(readFileSync(CG_PATH, 'utf8'))
const assembledNodeIds = graph.nodes.map((n) => n.tool_id)
const assembledChainNames = graph.chains.map((c) => c.name)

function describeUnassembled(dir, ids) {
  return ids.map((id) => {
    let label = '(unreadable)'
    try {
      const shard = JSON.parse(readFileSync(resolve(dir, `${id}.json`), 'utf8'))
      label = shard.mcp_name ?? shard.name ?? '(no name field)'
    } catch {
      // shard itself is malformed — still report the id
    }
    return { id, label }
  })
}

const allUnassembledNodeIds = findUnlistedShards(nodeShardIds, assembledNodeIds)
const waivedNodeIds = allUnassembledNodeIds.filter((id) => PAGE_BLOCKED_WAIVER.has(id))
const unassembledNodeIds = allUnassembledNodeIds.filter((id) => !PAGE_BLOCKED_WAIVER.has(id))
const unassembledChainIds = findUnlistedShards(chainShardIds, assembledChainNames)
const unassembledNodes = describeUnassembled(NODES_DIR, unassembledNodeIds)
const waivedNodes = describeUnassembled(NODES_DIR, waivedNodeIds)
const unassembledChains = describeUnassembled(CHAINS_DIR, unassembledChainIds)

// Reverse direction (nodes only, NODE-REGISTRATION-GAP-1): a chaingraph.json
// node whose shard file is absent from disk — a registry entry with no
// backing shard. Chains carry no reverse check (no incident measured yet).
const nodeShardIdSet = new Set(nodeShardIds)
const orphanedNodeIds = assembledNodeIds.filter((id) => !nodeShardIdSet.has(id)).sort()

if (waivedNodes.length > 0) {
  console.log(`check-shard-assembly: ${waivedNodes.length} node shard(s) under an explicit PAGE_BLOCKED_WAIVER (see top of this file) — informational, not a failure:`)
  for (const { id, label } of waivedNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})`)
  }
}

if (unassembledNodes.length === 0 && unassembledChains.length === 0 && orphanedNodeIds.length === 0) {
  console.log(`check-shard-assembly: OK — all ${nodeShardIds.length - waivedNodes.length}/${nodeShardIds.length} node shard(s) (excluding waived) and ${chainShardIds.length} chain shard(s) are present in the assembled chaingraph.json, and every assembled node has a backing shard.`)
  process.exit(0)
}

let nodesFailed = false

if (unassembledNodes.length > 0) {
  nodesFailed = true
  console.log(`check-shard-assembly: ${unassembledNodes.length} node shard(s) not yet in the assembled chaingraph.json:`)
  for (const { id, label } of unassembledNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})`)
  }
}
if (orphanedNodeIds.length > 0) {
  nodesFailed = true
  console.log(`check-shard-assembly: ${orphanedNodeIds.length} node(s) registered in chaingraph.json with NO backing shard file:`)
  for (const id of orphanedNodeIds) {
    console.log(`  - ${id}`)
  }
}
if (unassembledChains.length > 0) {
  console.log(`check-shard-assembly: ${unassembledChains.length} chain shard(s) not yet in the assembled chaingraph.json — this is EXPECTED for a shard whose land is still in flight, not necessarily a defect:`)
  for (const { id, label } of unassembledChains) {
    console.log(`  - ${id}  (name: ${label})`)
  }
}
console.log('check-shard-assembly: if none of these are mid-flight CGSHARD rows, an ASSEMBLE+LAND pass was missed (node case) or chaingraph.json was hand-edited (orphan case) — see board/STANDING-ORDERS.md #6.')

if (nodesFailed && NODES_BLOCKING) {
  console.log('check-shard-assembly: FAILING — node case is BLOCKING (NODE-REGISTRATION-GAP-1). Append the id(s) to chaingraph.meta.json order.nodes and re-run scripts/assemble-chaingraph.mjs, or add the missing shard file.')
  process.exit(1)
}
if (unassembledChains.length > 0 && CHAINS_BLOCKING) {
  process.exit(1)
}

console.log('check-shard-assembly: exiting 0 (chain case advisory; node case clean or its BLOCKING switch is off).')
process.exit(0)
