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
 * ⚠ ADVISORY ONLY — ALWAYS EXITS 0 (GATE-FREEZE, Tim 2026-07-18: no new
 * blocking gates until board-clear). A shard whose CGSHARD row is mid-flight
 * is EXPECTED to be unassembled — that is normal, transient state, not a
 * defect. This gate cannot tell mid-flight from stale (no timestamp/PR state
 * available to it); it reports the diff and lets a human judge it. Applies
 * identically to the new chain check — a chain shard's land row is still the
 * one that appends it to order.chains and re-runs the assembler.
 *
 * TO FLIP THIS GATE BLOCKING (only after the board-clear freeze lifts):
 *   change `const BLOCKING = false` below to `true`. That is the entire
 *   switch — no other code changes needed. Then add its line to
 *   scripts/preflight.mjs's GATES array (it is NOT wired there while
 *   advisory, since preflight only lists hard/blocking gates).
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

const BLOCKING = false // ← THE SWITCH. Flip to true once the gate-freeze lifts.

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

const unassembledNodeIds = findUnlistedShards(nodeShardIds, assembledNodeIds)
const unassembledChainIds = findUnlistedShards(chainShardIds, assembledChainNames)
const unassembledNodes = describeUnassembled(NODES_DIR, unassembledNodeIds)
const unassembledChains = describeUnassembled(CHAINS_DIR, unassembledChainIds)

if (unassembledNodes.length === 0 && unassembledChains.length === 0) {
  console.log(`check-shard-assembly: OK — all ${nodeShardIds.length} node shard(s) and ${chainShardIds.length} chain shard(s) are present in the assembled chaingraph.json.`)
  process.exit(0)
}

if (unassembledNodes.length > 0) {
  console.log(`check-shard-assembly: ${unassembledNodes.length} node shard(s) not yet in the assembled chaingraph.json — this is EXPECTED for a shard whose land is still in flight, not necessarily a defect:`)
  for (const { id, label } of unassembledNodes) {
    console.log(`  - ${id}  (mcp_name: ${label})`)
  }
}
if (unassembledChains.length > 0) {
  console.log(`check-shard-assembly: ${unassembledChains.length} chain shard(s) not yet in the assembled chaingraph.json — this is EXPECTED for a shard whose land is still in flight, not necessarily a defect:`)
  for (const { id, label } of unassembledChains) {
    console.log(`  - ${id}  (name: ${label})`)
  }
}
console.log('check-shard-assembly: if none of these are mid-flight CGSHARD rows, an ASSEMBLE+LAND pass was missed — see board/STANDING-ORDERS.md #6.')

if (BLOCKING) {
  process.exit(1)
}

console.log('check-shard-assembly: ADVISORY MODE — exiting 0 (gate-freeze in effect; see BLOCKING switch at top of this file).')
process.exit(0)
