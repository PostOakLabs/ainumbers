#!/usr/bin/env node
/**
 * scripts/check-tool-node-pairings.mjs — Tool-to-node pairing registry gate.
 *
 * data/tool-node-pairings.json records browser tools that intentionally keep
 * both their tool page (UI) AND a ChainGraph node (proof) for the same
 * computation. This gate verifies, for every registry entry: both the tool
 * page(s) and the node page exist on disk, and the cross-link is present in
 * BOTH directions (tool page links to the node page's art-NN filename; node
 * page links back to each tool page's filename).
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm/Ajv ever).
 *
 * Usage: node scripts/check-tool-node-pairings.mjs
 * Exit 0 = every pairing's files exist and are linked both directions.
 * Exit 1 = prints every violation.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const registryPath = resolve(root, 'data/tool-node-pairings.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf8'))

let failed = false
let checked = 0

for (const entry of registry.pairings) {
  const nodePath = resolve(root, entry.node_path)
  const nodeFile = basename(entry.node_path)

  if (!existsSync(nodePath)) {
    failed = true
    console.error(`check-tool-node-pairings: MISSING node page for ${entry.node_art}: ${entry.node_path}`)
    continue
  }
  const nodeContent = readFileSync(nodePath, 'utf8')

  for (const toolPath of entry.tool_paths) {
    checked++
    const toolAbs = resolve(root, toolPath)
    const toolFile = basename(toolPath)

    if (!existsSync(toolAbs)) {
      failed = true
      console.error(`check-tool-node-pairings: MISSING tool page: ${toolPath} (pairs with ${entry.node_art})`)
      continue
    }
    const toolContent = readFileSync(toolAbs, 'utf8')

    if (!toolContent.includes(entry.node_art)) {
      failed = true
      console.error(`check-tool-node-pairings: NO FORWARD LINK — ${toolPath} does not reference ${entry.node_art} (expected link to ${nodeFile})`)
    }

    if (!nodeContent.includes(toolFile)) {
      failed = true
      console.error(`check-tool-node-pairings: NO BACK LINK — ${entry.node_path} does not reference ${toolFile}`)
    }
  }
}

if (failed) {
  console.error('check-tool-node-pairings: FAILED — resolve missing files/links before pushing.')
  process.exit(1)
}

console.log(`check-tool-node-pairings: OK — ${registry.pairings.length} pairings, ${checked} tool-page links verified both directions.`)
