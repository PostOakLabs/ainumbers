#!/usr/bin/env node
/**
 * scripts/counts.mjs — Single source of truth for every published count.
 *
 * Exports deriveCounts() that reads all values from the filesystem.
 * Nothing else may compute a count; all generators and verify-counts import this.
 *
 * Keys returned:
 *   tools.browser      tools/*.html count
 *   manifests          manifests/*.manifest.json count (excluding DELETE ME)
 *   guides.hubs        guides/*-hub.html count
 *   categories         cat-heading spans in tools.html
 *   chains             chaingraph.json chains[] length
 *   workflows.recipes  workflow data rows in mcp.html
 *   mcp.live           chaingraph live nodes + pilot_widgets + utility_tools
 *                      (pilot + utility sourced from data/mcp-counts.json)
 *   openapi.ops        unique mcp_names from manifests + chaingraph nodes
 *                      (same derivation as gen-openapi.mjs — not read from generated file)
 *
 * mcp.live != openapi.ops by design:
 *   mcp.live   = callable tools registered on the live /mcp endpoint
 *   openapi.ops = documented operations in the OpenAPI descriptive artifact
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const repoRoot = resolve(__dirname, '..')

export function deriveCounts() {
  // tools.browser
  const toolsBrowser = readdirSync(resolve(repoRoot, 'tools'))
    .filter(f => f.endsWith('.html')).length

  // manifests
  const manifests = readdirSync(resolve(repoRoot, 'manifests'))
    .filter(f => f.endsWith('.manifest.json') && !f.includes('DELETE')).length

  // guides.hubs
  const guidesHubs = readdirSync(resolve(repoRoot, 'guides'))
    .filter(f => f.endsWith('-hub.html')).length

  // categories — class="cat-heading" spans in tools.html
  const toolsHtml = readFileSync(resolve(repoRoot, 'tools.html'), 'utf8')
  const categories = (toolsHtml.match(/class="cat-heading"/g) || []).length

  // chains
  const chaingraph = JSON.parse(readFileSync(resolve(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'))
  const chains = (chaingraph.chains ?? []).length

  // workflows.recipes — data rows in the workflows table in mcp.html
  const mcpHtml = readFileSync(resolve(repoRoot, 'mcp.html'), 'utf8')
  const wfStart = mcpHtml.indexOf('id="workflows"')
  const wfEnd   = mcpHtml.indexOf('</table>', wfStart)
  const wfSection = (wfStart !== -1 && wfEnd !== -1) ? mcpHtml.slice(wfStart, wfEnd) : ''
  const workflowsRecipes = (wfSection.match(/<tr><td>/g) || []).length

  // mcp.live — chaingraph live nodes + pilot widgets + utility tools
  const mcpCountsData = JSON.parse(
    readFileSync(resolve(repoRoot, 'data', 'mcp-counts.json'), 'utf8')
  )
  const liveNodes = (chaingraph.nodes ?? []).filter(n => n.status === 'live').length
  const mcpLive = liveNodes + mcpCountsData.pilot_widgets + mcpCountsData.utility_tools

  // openapi.ops — unique mcp_names: all manifests + chaingraph nodes not already covered
  const byMcpName = new Set()
  const manifestFiles = readdirSync(resolve(repoRoot, 'manifests'))
    .filter(f => f.endsWith('.manifest.json') && !f.includes('DELETE'))
  for (const file of manifestFiles) {
    let manifest
    try { manifest = JSON.parse(readFileSync(resolve(repoRoot, 'manifests', file), 'utf8')) } catch { continue }
    const mcpName = manifest?.mcp_tool_definition?.name
    if (mcpName) byMcpName.add(mcpName)
  }
  for (const node of chaingraph.nodes ?? []) {
    if (node.mcp_name && !byMcpName.has(node.mcp_name)) byMcpName.add(node.mcp_name)
  }
  const openapiOps = byMcpName.size

  return {
    'tools.browser':     toolsBrowser,
    'manifests':         manifests,
    'guides.hubs':       guidesHubs,
    'categories':        categories,
    'chains':            chains,
    'workflows.recipes': workflowsRecipes,
    'mcp.live':          mcpLive,
    'openapi.ops':       openapiOps,
  }
}

// When run directly, print JSON to stdout
if (resolve(process.argv[1]) === resolve(__filename)) {
  const counts = deriveCounts()
  process.stdout.write(JSON.stringify(counts, null, 2) + '\n')
}
