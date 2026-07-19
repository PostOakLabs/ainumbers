#!/usr/bin/env node
/**
 * scripts/check-shard-assembly.mjs — ASSEMBLE-COVER-1 gate.
 *
 * Detects UNASSEMBLED SHARDS: a file in chaingraph/graph/nodes/*.json whose
 * tool_id is absent from the assembled chaingraph/chaingraph.json node set.
 * This is the failure class ASSEMBLE-LAND-3 (missed art-386) and
 * ASSEMBLE-LAND-5 (missed art-407) both hit — a land ran without every shard
 * folded into the meta order + assembled graph, and nothing caught it.
 *
 * ⚠ ADVISORY ONLY — ALWAYS EXITS 0 (GATE-FREEZE, Tim 2026-07-18: no new
 * blocking gates until board-clear). A shard whose CGSHARD row is mid-flight
 * is EXPECTED to be unassembled — that is normal, transient state, not a
 * defect. This gate cannot tell mid-flight from stale (no timestamp/PR state
 * available to it); it reports the diff and lets a human judge it.
 *
 * TO FLIP THIS GATE BLOCKING (only after the board-clear freeze lifts):
 *   change `const BLOCKING = false` below to `true`. That is the entire
 *   switch — no other code changes needed. Then add its line to
 *   scripts/preflight.mjs's GATES array (it is NOT wired there while
 *   advisory, since preflight only lists hard/blocking gates).
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP).
 *
 * Usage: node scripts/check-shard-assembly.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const BLOCKING = false // ← THE SWITCH. Flip to true once the gate-freeze lifts.

const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')

const shardIds = readdirSync(NODES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length))
  .sort()

const graph = JSON.parse(readFileSync(CG_PATH, 'utf8'))
const assembled = new Map(graph.nodes.map((n) => [n.tool_id, n.mcp_name]))

const unassembled = []
for (const id of shardIds) {
  if (!assembled.has(id)) {
    let mcp_name = '(unreadable)'
    try {
      const shard = JSON.parse(readFileSync(resolve(NODES_DIR, `${id}.json`), 'utf8'))
      mcp_name = shard.mcp_name ?? '(no mcp_name field)'
    } catch {
      // shard itself is malformed — still report the tool_id
    }
    unassembled.push({ tool_id: id, mcp_name })
  }
}

if (unassembled.length === 0) {
  console.log(`check-shard-assembly: OK — all ${shardIds.length} node shards are present in the assembled chaingraph.json.`)
  process.exit(0)
}

console.log(`check-shard-assembly: ${unassembled.length} shard(s) not yet in the assembled chaingraph.json — this is EXPECTED for a shard whose land is still in flight, not necessarily a defect:`)
for (const { tool_id, mcp_name } of unassembled) {
  console.log(`  - ${tool_id}  (mcp_name: ${mcp_name})`)
}
console.log('check-shard-assembly: if none of these are mid-flight CGSHARD rows, an ASSEMBLE+LAND pass was missed — see board/STANDING-ORDERS.md #6.')

if (BLOCKING) {
  process.exit(1)
}

console.log('check-shard-assembly: ADVISORY MODE — exiting 0 (gate-freeze in effect; see BLOCKING switch at top of this file).')
process.exit(0)
