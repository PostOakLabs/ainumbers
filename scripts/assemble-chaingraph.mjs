#!/usr/bin/env node
/**
 * scripts/assemble-chaingraph.mjs — generates chaingraph/chaingraph.json from
 * its shards (chaingraph/graph/nodes/*.json, chaingraph/graph/chains/*.json,
 * chaingraph.meta.json). chaingraph.json is a COMMITTED GENERATED artifact,
 * same pattern as kernels/index.mjs — consumers (generate.mjs vendor copy,
 * worker, gates, runtime pages) keep reading it unchanged.
 *
 * New waves write shard files directly (chaingraph/graph/nodes/<tool_id>.json
 * + chaingraph/graph/chains/<name>.json) and append their id/name to
 * chaingraph.meta.json's order.nodes/order.chains — NEVER push into the
 * monolith. Run this script to regenerate chaingraph.json afterward.
 *
 * Modes:
 *   node scripts/assemble-chaingraph.mjs           # writes chaingraph.json
 *   node scripts/assemble-chaingraph.mjs --check   # verify only, exit 1 on drift
 *
 * MIGRATION MODE (CS-1): reassembly uses the `raw` glue block in
 * chaingraph.meta.json to reproduce the legacy monolith byte-identically,
 * including its as-authored (non-canonical) insertion order and per-element
 * whitespace. CS-2 flips to canonical sorted order + uniform formatting and
 * drops the `raw` block — that is a separate, reviewable commit.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')
const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(root, 'chaingraph/graph/chains')
const META_PATH = resolve(root, 'chaingraph/chaingraph.meta.json')

const CHECK = process.argv.includes('--check')

const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
const { order, raw } = meta

if (!raw) {
  console.error('assemble-chaingraph.mjs: meta.raw missing — canonical (post-CS-2) generation not yet implemented. This build is MIGRATION MODE only.')
  process.exit(1)
}

function readShard(dir, id) {
  const text = readFileSync(resolve(dir, `${id}.json`), 'utf8')
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

const nodeTexts = order.nodes.map((id) => readShard(NODES_DIR, id))
const chainTexts = order.chains.map((name) => readShard(CHAINS_DIR, name))

if (nodeTexts.length !== raw.nodeSeparators.length || chainTexts.length !== raw.chainSeparators.length) {
  console.error('assemble-chaingraph.mjs: order/separator length mismatch — meta.json is inconsistent (did a shard get added without updating raw.*Separators?).')
  process.exit(1)
}

let nodesJoined = ''
nodeTexts.forEach((text, i) => { nodesJoined += text + raw.nodeSeparators[i] })

let chainsJoined = ''
chainTexts.forEach((text, i) => { chainsJoined += text + raw.chainSeparators[i] })

const assembled = raw.header + nodesJoined + raw.betweenNodesAndChains + chainsJoined + raw.footer

if (CHECK) {
  const committed = readFileSync(CG_PATH, 'utf8')
  if (assembled === committed) {
    console.log(`OK  chaingraph.json matches assembled output (${order.nodes.length} nodes, ${order.chains.length} chains).`)
    process.exit(0)
  } else {
    console.error('DRIFT  chaingraph.json does NOT match assembled output from shards.')
    console.error(`  committed length: ${committed.length}, assembled length: ${assembled.length}`)
    for (let i = 0; i < Math.min(committed.length, assembled.length); i++) {
      if (committed[i] !== assembled[i]) {
        console.error(`  first diff at byte ${i}:`)
        console.error(`  committed: ${JSON.stringify(committed.slice(Math.max(0, i - 30), i + 30))}`)
        console.error(`  assembled: ${JSON.stringify(assembled.slice(Math.max(0, i - 30), i + 30))}`)
        break
      }
    }
    console.error('  Run `node scripts/assemble-chaingraph.mjs` (no --check) to regenerate, then commit chaingraph.json.')
    process.exit(1)
  }
} else {
  writeFileSync(CG_PATH, assembled, 'utf8')
  console.log(`Wrote ${CG_PATH} (${order.nodes.length} nodes, ${order.chains.length} chains).`)
}
