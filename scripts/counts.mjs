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
 *   mcp.widgets        pilot_widgets alone (data/mcp-counts.json)
 *   openapi.ops        unique mcp_names from manifests + chaingraph nodes
 *                      (same derivation as gen-openapi.mjs — not read from generated file)
 *   zk.provenNodes     live nodes carrying a valid ZK compute_proof (any gpu flag)
 *   zk.provenTotal     live nodes in scope for ZK proof (today == all live nodes)
 *   zk.provenPct       floor(100 * zk.provenNodes / zk.provenTotal) — floored so 100 means 100
 *                      (derived via check-compute-proof-coverage.mjs's classifyNode/zkCoverage —
 *                      one classifier, two callers; see ZK100-MESSAGING-SPEC.md §1)
 *   fv.floorFloored    live kernels with a digest-matched PBT floor file (FV-COVERAGE-GATE-1)
 *   fv.floorTotal      live kernels in scope for the floor (== fv.floorFloored + unfloored)
 *   fv.floorPct        floor(100 * fv.floorFloored / fv.floorTotal) — floored so 100 means 100
 *                      (derived via check-fv-floor-coverage.mjs's deriveLiveKernels/evaluateCoverage —
 *                      one classifier, two callers, same shape as zk.* above. PBT-floor tier only —
 *                      internal engineering QC, not the formal-verification pilot on methods.html)
 *   chainL2.gatePass          L2-G gate rules decided pass, fail, indeterminate, and the total in
 *   chainL2.gateFail          scope — chain-level edge-contract composition (CHAIN-FV-L2-COPY-1),
 *   chainL2.gateIndeterminate derived fresh each call from check-chain-l2-contracts.mjs's own
 *   chainL2.gateTotal         buildReport() (SO #34 independent derivation — never read back from a
 *                             report file it already wrote). NOT a claim of formal verification; see
 *                             fv-explainer.html's boundary statement for what L2 does and does not cover.
 *   hubTools.dora           } number of distinct ../tools/*.html links inside class="tool-card-link"
 *   hubTools.fraudRisk      } anchors on the named guides/*-hub.html page (CLAIMS-SENTINEL-TIER1-1,
 *   hubTools.sme            } audit Q7 — the hub hero paragraphs' spelled-out tool counts, unprotected
 *   hubTools.tradetech      } and drifted for the DORA hub: hero said "Eleven", the page carried 12).
 *   hubTools.capitalMarkets } chaingraph/-linked "provable node" cards on the same page are excluded —
 *                             those pages explicitly describe them as a separate, non-browser-tool family.
 *
 * mcp.live != openapi.ops by design:
 *   mcp.live   = callable tools registered on the live /mcp endpoint
 *   openapi.ops = documented operations in the OpenAPI descriptive artifact
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { zkCoverage } from './check-compute-proof-coverage.mjs'
import { deriveLiveKernels, evaluateCoverage } from './check-fv-floor-coverage.mjs'
import { sourceDigest } from '../chaingraph/kernels/_buildid.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const repoRoot = resolve(__dirname, '..')

// countHubTools — number of distinct browser tools (../tools/*.html) a guides/*-hub.html page
// links to via <a class="tool-card-link" href="../tools/...">. Attribute order varies across hub
// pages (href-then-class vs class-then-href), so this scans whole <a ...> tags rather than
// anchoring the regex to one order. Deliberately excludes ../chaingraph/... links: several hubs
// (tradetech, capital-markets) mix in "provable node"/chain cards using the same tool-card markup,
// and those pages' own prose already describes that family as separate from "N browser-based tools".
function countHubTools(hubFile) {
  const html = readFileSync(resolve(repoRoot, 'guides', hubFile), 'utf8')
  const anchorRe = /<a\b[^>]*>/g
  const seen = new Set()
  let m
  while ((m = anchorRe.exec(html))) {
    const tag = m[0]
    if (!/class="tool-card-link"/.test(tag)) continue
    const hrefMatch = tag.match(/href="(\.\.\/tools\/[^"]+\.html)"/)
    if (hrefMatch) seen.add(hrefMatch[1])
  }
  return seen.size
}

export async function deriveCounts() {
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
  const mcpWidgets = mcpCountsData.pilot_widgets

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

  // zk.* — ZK100-MESSAGING-SPEC.md §1: reuses the §18 gate's classifier (one classifier, two callers)
  const { provenNodes, provenTotal, provenPct } = zkCoverage(chaingraph)

  // fv.floor* — FV-COVERAGE-GATE-1: reuses that gate's own live-kernel derivation + digest classifier
  // (one classifier, two callers, same shape as zk.* above) — never a second enumeration of the kernel tree.
  const KDIR = resolve(repoRoot, 'chaingraph', 'kernels')
  const PROPTESTS_DIR = resolve(KDIR, '__proptests__')
  const readKernelSource = (tool_id) => {
    const p = resolve(KDIR, `${tool_id}.kernel.mjs`)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const readFloorSource = (tool_id) => {
    const p = resolve(PROPTESTS_DIR, `${tool_id}.proptest.mjs`)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const { liveKernels } = deriveLiveKernels()
  const { floored: fvFloored, total: fvTotal } = await evaluateCoverage(liveKernels, readKernelSource, readFloorSource, sourceDigest)
  const fvFloorPct = fvTotal > 0 ? Math.floor(100 * fvFloored.length / fvTotal) : 0

  // chainL2.* — CHAIN-FV-L2-COPY-1: fresh buildReport() call, same shape as the checker's own CLI run.
  const [{ buildReport: buildL1Report }, { buildReport: buildL2Report }] = await Promise.all([
    import('./check-chain-edge-contracts.mjs'),
    import('./check-chain-l2-contracts.mjs'),
  ])
  const l1ReportForL2 = buildL1Report(repoRoot)
  const l2Report = buildL2Report(repoRoot, l1ReportForL2)
  const chainL2GatePass = l2Report.summary.edges_pass
  const chainL2GateFail = l2Report.summary.edges_fail
  const chainL2GateIndeterminate = l2Report.summary.edges_indeterminate
  const chainL2GateTotal = l2Report.summary.gates_checked

  // hubTools.* — CLAIMS-SENTINEL-TIER1-1 (audit Q7): the five hub hero paragraphs' spelled-out
  // tool counts, previously hand-typed prose with nothing re-deriving them from the page itself.
  const hubToolsDora           = countHubTools('dora-operational-resilience-hub.html')
  const hubToolsFraudRisk      = countHubTools('fraud-risk-hub.html')
  const hubToolsSme            = countHubTools('sme-financial-health-hub.html')
  const hubToolsTradetech      = countHubTools('tradetech-hub.html')
  const hubToolsCapitalMarkets = countHubTools('capital-markets-settlement-hub.html')

  return {
    'tools.browser':     toolsBrowser,
    'manifests':         manifests,
    'guides.hubs':       guidesHubs,
    'categories':        categories,
    'chains':            chains,
    'workflows.recipes': workflowsRecipes,
    'mcp.live':          mcpLive,
    'mcp.widgets':       mcpWidgets,
    'openapi.ops':       openapiOps,
    'zk.provenNodes':    provenNodes,
    'zk.provenTotal':    provenTotal,
    'zk.provenPct':      provenPct,
    'fv.floorFloored':   fvFloored.length,
    'fv.floorTotal':     fvTotal,
    'fv.floorPct':       fvFloorPct,
    'chainL2.gatePass':          chainL2GatePass,
    'chainL2.gateFail':          chainL2GateFail,
    'chainL2.gateIndeterminate': chainL2GateIndeterminate,
    'chainL2.gateTotal':         chainL2GateTotal,
    'hubTools.dora':             hubToolsDora,
    'hubTools.fraudRisk':        hubToolsFraudRisk,
    'hubTools.sme':              hubToolsSme,
    'hubTools.tradetech':        hubToolsTradetech,
    'hubTools.capitalMarkets':   hubToolsCapitalMarkets,
  }
}

// When run directly, print JSON to stdout
if (resolve(process.argv[1]) === resolve(__filename)) {
  const counts = await deriveCounts()
  process.stdout.write(JSON.stringify(counts, null, 2) + '\n')
}
