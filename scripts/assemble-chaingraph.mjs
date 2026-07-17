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
 * CANONICAL ORDER (CS-2, replaces CS-1's migration-mode byte-parity glue):
 * nodes are emitted sorted by tool_id, chains sorted by name, both via a
 * numeric-aware natural sort (so "art-9" < "art-10" < "art-100", not
 * lexical). order.nodes/order.chains in chaingraph.meta.json are the SET of
 * shard ids to include — a future WU only needs to append its id there;
 * this script re-sorts at assembly time regardless of array position, so
 * append order never affects the emitted order. Separators between elements
 * are uniform (",\n    " between elements, "\n  " after the last) since
 * shard formatting is already normalized — no more per-position separator
 * array. meta.raw.header/betweenNodesAndChains/footer (the fixed wrapper
 * text: $schema, version, metadata block, closing brace) are unchanged by
 * this flip — only node/chain ORDER and inter-element whitespace changed.
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
  console.error('assemble-chaingraph.mjs: meta.raw missing — header/footer wrapper text is required.')
  process.exit(1)
}

const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare

function readShard(dir, id) {
  const text = readFileSync(resolve(dir, `${id}.json`), 'utf8')
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

const sortedNodeIds = [...order.nodes].sort(naturalSort)
const sortedChainIds = [...order.chains].sort(naturalSort)

const nodeTexts = sortedNodeIds.map((id) => readShard(NODES_DIR, id))
const chainTexts = sortedChainIds.map((name) => readShard(CHAINS_DIR, name))

function joinShards(texts) {
  let joined = ''
  texts.forEach((text, i) => { joined += text + (i < texts.length - 1 ? ',\n    ' : '\n  ') })
  return joined
}

const nodesJoined = joinShards(nodeTexts)
const chainsJoined = joinShards(chainTexts)

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
