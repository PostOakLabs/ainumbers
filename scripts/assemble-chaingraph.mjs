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
 *
 * CANONICAL SHARD FORMAT (SHARD-DRIFT-CLASSIFY-1): a node shard's
 * `compute_images` array and siblings COMPACT to one line
 * (`"compute_images": [{...}]`, not one key/element per line) — every
 * pre-ZK shard already looks like this. This assembler splices shard text
 * VERBATIM (readShard/joinShards above), so shard format IS artifact
 * format: a shard written multi-line ships multi-line into chaingraph.json
 * and immediately drifts against this rule. Match an existing compact
 * shard, don't reformat after the fact.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const CG_PATH = resolve(root, 'chaingraph/chaingraph.json')
const NODES_DIR = resolve(root, 'chaingraph/graph/nodes')
const CHAINS_DIR = resolve(root, 'chaingraph/graph/chains')
const META_PATH = resolve(root, 'chaingraph/chaingraph.meta.json')

const CHECK = process.argv.includes('--check')

// ASSEMBLE-COVER-1 advisory: report node shards on disk that order.nodes
// doesn't include yet — a mid-flight CGSHARD row is EXPECTED here, so this
// only informs, never fails the assembler.
function reportUnassembledShards(orderNodes) {
  const onDisk = readdirSync(NODES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
  const known = new Set(orderNodes)
  const extra = onDisk.filter((id) => !known.has(id))
  if (extra.length > 0) {
    console.log(`assemble-chaingraph: ${extra.length} node shard(s) on disk not in chaingraph.meta.json order.nodes (expected if mid-flight): ${extra.join(', ')}`)
  }
}

const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
const { order, raw } = meta

if (!raw) {
  console.error('assemble-chaingraph.mjs: meta.raw missing — header/footer wrapper text is required.')
  process.exit(1)
}

const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare

// SHARD-DRIFT-CLASSIFY-1: chaingraph.json stores no literal "execution_hash"
// field — it's computed at runtime by _hash.mjs from a node's content. But
// that hash is a pure function of the content, so two byte-differing
// chaingraph.json files carry the SAME hash set iff every node's PARSED
// content is deep-equal. Canonicalize (sort keys recursively) so a pure
// formatting difference (the only kind CS-2 shard compaction produces)
// never registers as a content change.
function canon(value) {
  if (Array.isArray(value)) return value.map(canon)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = canon(value[k])
      return acc
    }, {})
  }
  return value
}

// Diffs one committed/assembled array pair keyed by `keyField`, appending
// changed keys to `changedIds`. Shared by nodes (keyed tool_id) and chains
// (keyed name — chains carry no id) so the two never share one map.
function diffByKey(committedArr, assembledArr, keyField, changedIds) {
  const cMap = new Map(committedArr.map((x) => [x[keyField], JSON.stringify(canon(x))]))
  const aMap = new Map(assembledArr.map((x) => [x[keyField], JSON.stringify(canon(x))]))
  for (const [id, text] of aMap) {
    if (cMap.get(id) !== text) changedIds.push(id)
  }
  for (const id of cMap.keys()) {
    if (!aMap.has(id)) changedIds.push(id)
  }
}

// Returns { verdict: 'HASH-NEUTRAL' | 'HASH-MOVING' | null, changedIds }.
// verdict is null only on a JSON.parse failure (caller falls back to the
// plain DRIFT message, no verdict claimed). SHARD-DRIFT-CHAINS-1: folds
// .chains into the same verdict — a chain-only semantic edit (steps,
// title, domain) is vendored content too and must not read HASH-NEUTRAL.
// Chains have no `id` field (keyed `name`), so nodes and chains diff via
// separate maps (diffByKey) rather than one shared map.
function classifyDrift(committedText, assembledText) {
  let committedObj, assembledObj
  try {
    committedObj = JSON.parse(committedText)
    assembledObj = JSON.parse(assembledText)
  } catch {
    return { verdict: null, changedIds: [] }
  }
  const changedIds = []
  diffByKey(committedObj.nodes, assembledObj.nodes, 'tool_id', changedIds)
  diffByKey(committedObj.chains, assembledObj.chains, 'name', changedIds)
  return { verdict: changedIds.length === 0 ? 'HASH-NEUTRAL' : 'HASH-MOVING', changedIds }
}

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
    reportUnassembledShards(order.nodes)
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
    const { verdict, changedIds } = classifyDrift(committed, assembled)
    if (verdict === 'HASH-NEUTRAL') {
      console.error('  HASH-NEUTRAL DRIFT — run the assembler and commit chaingraph.json in THIS push. Do NOT ride ASSEMBLE-LAND. Do NOT --no-verify.')
    } else if (verdict === 'HASH-MOVING') {
      console.error(`  HASH-MOVING DRIFT — BLOCKED-complete per RUNBOOK -0.7; the ASSEMBLE-LAND lands it per -0.6. (${changedIds.length} node(s) changed: ${changedIds.slice(0, 10).join(', ')}${changedIds.length > 10 ? ', ...' : ''})`)
    }
    console.error('  Run `node scripts/assemble-chaingraph.mjs` (no --check) to regenerate, then commit chaingraph.json.')
    process.exit(1)
  }
} else {
  // ASSEMBLE-MAINSIDE-1: write mode now runs unattended from the main-side
  // regen workflow, so it must refuse (not just diff-report) the classes of
  // change that still require a human ASSEMBLE/LAND row — node removals/
  // renames and any chain edit. A refusal is a distinct no-op state (SO
  // #34c), not a failure: exit 0, print the reason, write nothing.
  let committed = ''
  try { committed = readFileSync(CG_PATH, 'utf8') } catch { /* first run, no committed file yet */ }

  if (assembled === committed) {
    console.log(`assemble-chaingraph: already up to date (${order.nodes.length} nodes, ${order.chains.length} chains).`)
    reportUnassembledShards(order.nodes)
    process.exit(0)
  }

  let refused = false
  if (committed) {
    let committedObj, assembledObj
    try {
      committedObj = JSON.parse(committed)
      assembledObj = JSON.parse(assembled)
    } catch {
      console.error('assemble-chaingraph: committed or assembled chaingraph.json failed to parse — refusing to write (cannot safety-check a malformed tree).')
      process.exit(1)
    }
    const committedIds = new Set(committedObj.nodes.map((n) => n.tool_id))
    const assembledIds = new Set(assembledObj.nodes.map((n) => n.tool_id))
    const removedNodes = [...committedIds].filter((id) => !assembledIds.has(id))
    const chainsChanged = JSON.stringify(canon(committedObj.chains)) !== JSON.stringify(canon(assembledObj.chains))
    if (removedNodes.length > 0 || chainsChanged) {
      refused = true
      const reasons = []
      if (removedNodes.length > 0) reasons.push(`node removal(s)/rename(s): ${removedNodes.join(', ')}`)
      if (chainsChanged) reasons.push('graph/chains/ change(s)')
      console.log(`assemble-chaingraph: REFUSED — diff includes ${reasons.join(' and ')}. This is out of scope for the main-side auto-assembler (single-node/small-additive only) and requires an explicit ASSEMBLE/LAND row. No write, no commit.`)
    }
  }

  if (!refused) {
    writeFileSync(CG_PATH, assembled, 'utf8')
    console.log(`Wrote ${CG_PATH} (${order.nodes.length} nodes, ${order.chains.length} chains).`)
  }
  reportUnassembledShards(order.nodes)
}
