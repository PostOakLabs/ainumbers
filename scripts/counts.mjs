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
 *   chainL2.sharedPass          L2-S shared-input coherence chain verdicts (pass/fail/indeterminate)
 *   chainL2.sharedFail          and the number of shared input fields examined, from the same
 *   chainL2.sharedIndeterminate buildReport() call as chainL2.gate* (WHITEPAPER-CORRECTIONS-1 —
 *   chainL2.sharedFields        the paper's §11.7 L2-S sentence had no sentinel and rotted).
 *   nodes.live         chaingraph.json nodes with status live (the paper's node headline;
 *                      distinct from zk.provenTotal, which is the §18 proof-scope denominator
 *                      even though the two coincide today)
 *   chains.gated       chains with at least one step carrying a gate object
 *   webmcp.pages       chaingraph/*.html pages carrying a WebMCP registerTool( call
 *                      (WHITEPAPER-CORRECTIONS-1 — the paper's §8.4 count said 3 while 19
 *                      pages were registered; a hand-typed registration count rots by tranche)
 *   hubCounts          every hub, keyed by slug: { dir, file, tools, nodes, chains, claimed }.
 *                      Measured by a loop over guides/*-hub.html + chaingraph/guide-*.html, so a
 *                      hub added tomorrow is counted the day it lands (HUB-COUNT-COUNTERS-SSOT-1).
 *                      tools/nodes/chains are three SEPARATE families per the board's noun ruling
 *                      (2026-09-18T19:2xZ item 4, "a ChainGraph node card is NOT a tool");
 *                      `claimed` is the numeral the page's meta description claims today, or null.
 *                      See the counter block below for each family's exact rule.
 *   hubTools.dora           } ALIASES onto hubCounts[<slug>].tools for the five hubs whose
 *   hubTools.fraudRisk      } meta/og/JSON-LD descriptions carry a count sentinel
 *   hubTools.sme            } (CLAIMS-SENTINEL-TIER1-1, audit Q7 — the hub hero paragraphs' tool
 *   hubTools.tradetech      } counts were hand-typed and drifted: the DORA hero said "Eleven"
 *   hubTools.capitalMarkets } while the page carried 12). Kept as keys so no shipped sentinel or
 *                             ATTR_RULE changes; the values are the browser-tool count only,
 *                             never the node or chain count.
 *
 * Re-derivable per-hub measurement table (replaces plan v2's hand-copied 42-row decision table —
 * nothing downstream should copy numbers out of a document):
 *   node scripts/counts.mjs --report
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

// MERGEGROUP-HARD-GATES-1: overlay-read for the DERIVED inputs of these counts
// (tools.html, chaingraph.json, mcp.html, data/mcp-counts.json). On merge_group
// DERIVED_ROOT points at the ephemeral assembled tree — read the scratch copy
// when the assembly produced one, the checkout otherwise. Authored inputs
// (tools/, manifests/, guides/ directory scans) stay repo-rooted: they are not
// derived, so the checkout is already authoritative for them.
const DERIVED_ROOT = process.env.DERIVED_ROOT && process.env.DERIVED_ROOT.trim()
  ? resolve(repoRoot, process.env.DERIVED_ROOT.trim()) : null
function readDerived(...parts) {
  const scratch = DERIVED_ROOT ? resolve(DERIVED_ROOT, ...parts) : null
  return readFileSync(scratch && existsSync(scratch) ? scratch : resolve(repoRoot, ...parts), 'utf8')
}

// ── hub card counters (HUB-COUNT-COUNTERS-SSOT-1) ────────────────────────────
//
// THE NOUN RULING THAT SHAPES ALL OF THIS (board RULINGS 2026-09-18T19:2xZ item 4):
// **a ChainGraph node card is NOT a tool.** So a hub is never measured by one number.
// Every hub page is measured by three independent counters over its own card anchors:
//
//   tools  — distinct browser tools:      ../tools/<name>.html
//   nodes  — distinct ChainGraph nodes:   ../chaingraph/art-<N>-<slug>.html  (bare art-… in
//                                         chaingraph/guide-*.html, which is already inside
//                                         that directory)
//   chains — distinct chain pages:        ../chaingraph/chains/<slug>.html   (bare chains/… ditto)
//
// A hub whose copy says "N tools" while its cards are nodes is a COPY defect, surfaced by
// --report; it is never repaired by letting a node count as a tool.
//
// Why a class-token SET and not one literal class name: the shipped rule required exactly
// class="tool-card-link", so four hubs whose cards use class="tool-card" measured 0
// (HUB-COUNT-SENTINEL-REMEDIATION-PLAN-v2-2026-09.md §3b). Measured class tokens carrying a
// card href across all 53 guides/*-hub.html + 33 chaingraph/guide-*.html pages on
// origin/main @ f8eb802f: tool-card-link 503, card 211, chain 101, node-link 16, chain-card 15,
// chain-card-link 14, tool-card 13, related-card 10, chain-link 10, workflow-link 5.
// related-card is deliberately absent from every set below — it links sibling hub pages
// (../tools.html#cat-29 and friends), not cards of the counted families.
//
// Attribute order varies across hub pages (href-then-class vs class-then-href), so this scans
// whole <a ...> tags rather than anchoring a regex to one order. An ../tools/ link in nav or
// prose carries no card class and is excluded by construction — that is the same property the
// href+class pairing has always had, and §3a measured it twice (payment-scheme-network: 16 raw
// ../tools/ links, 14 in a card; treasury-liquidity: 19 raw, 18 in a card).

const TOOL_CARD_CLASSES = new Set(['tool-card-link', 'tool-card'])
// Node cards in guides/*-hub.html: the tool-card families (several hubs link nodes through
// them), plus node-link and chain-card-link.
const NODE_CARD_CLASSES = new Set(['tool-card-link', 'tool-card', 'node-link', 'chain-card-link', 'card'])
// Chain-page cards add the three workflow/chain link classes on top of the node set.
const CHAIN_CARD_CLASSES = new Set([...NODE_CARD_CLASSES, 'workflow-link', 'chain-link', 'chain-card', 'chain'])
// chaingraph/guide-*.html uses ONE card class for both nodes and chains. Plan v2 §3c defines the
// node rule for these pages verbatim — quoted because this module is now its only implementation:
//   "Their "N tools" means ChainGraph **nodes**: `<a class="card" href="art-NN-*.html">`. Deriving
//    that way (`countChainGuideNodes` = distinct `art-\d+-*.html` hrefs in `class="card"` anchors)
//    gives 10 agree / 4 disagree"
// and for the chain figure on the same pages: "also claims "11 chains", = 11 `card chain` anchors".
// Both are the `card` token; the href target is what separates a node from a chain.
const CHAIN_GUIDE_CARD_CLASSES = new Set(['card'])

// Every <a> tag carrying both a class and an href, as { classes, href }.
function* cardAnchors(html) {
  const anchorRe = /<a\b[^>]*>/g
  let m
  while ((m = anchorRe.exec(html))) {
    const tag = m[0]
    const classMatch = tag.match(/class="([^"]*)"/)
    const hrefMatch = tag.match(/href="([^"]+)"/)
    if (!classMatch || !hrefMatch) continue
    yield { classes: classMatch[1].trim().split(/\s+/), href: hrefMatch[1] }
  }
}

// Distinct hrefs matching `target` on anchors carrying at least one class token in `classes`.
// Distinct, so a hub that links the same page from two cards counts it once.
function countCards(html, classes, target) {
  const seen = new Set()
  for (const { classes: tokens, href } of cardAnchors(html)) {
    if (!tokens.some(t => classes.has(t))) continue
    if (target.test(href)) seen.add(href)
  }
  return seen.size
}

const readHub = (dir, file) => readFileSync(resolve(repoRoot, dir, file), 'utf8')

// Each counter is a PURE html→number function (the *In form, exercised directly by
// scripts/counts.test.mjs against inline fixtures — no fixture file ever lands in guides/ or
// chaingraph/, where it would be a published page) plus a thin file-reading wrapper below.

// Target shapes. `\d+` then any non-/ tail, so art-01-… and art-385-… both match and a
// chains/ path never does.
const TOOLS_HREF        = /^\.\.\/tools\/[^/]+\.html$/
const HUB_NODE_HREF     = /^\.\.\/chaingraph\/art-\d+[^/]*\.html$/
const HUB_CHAIN_HREF    = /^\.\.\/chaingraph\/chains\/[^/]+\.html$/
const GUIDE_NODE_HREF   = /^art-\d+[^/]*\.html$/
const GUIDE_CHAIN_HREF  = /^chains\/[^/]+\.html$/

// countHubTools — distinct browser tools (../tools/*.html) a hub page links to from a card.
// Keeps the shipped ../tools/ href filter exactly (the ruling above is why: widening the class
// without keeping the href filter would have counted ChainGraph nodes as tools on three hubs);
// only the class test widened, from the single literal tool-card-link to TOOL_CARD_CLASSES.
// `dir` is 'guides' (default, so every existing caller is unchanged) or 'chaingraph'.
export const hubToolsIn = (html) => countCards(html, TOOL_CARD_CLASSES, TOOLS_HREF)
export function countHubTools(hubFile, dir = 'guides') {
  return hubToolsIn(readHub(dir, hubFile))
}

// countHubNodes — distinct ChainGraph node pages (../chaingraph/art-<N>-*.html) a
// guides/*-hub.html page links to from a card. The sibling countHubTools cannot and must not
// count these (noun ruling item 4).
export const hubNodesIn = (html) => countCards(html, NODE_CARD_CLASSES, HUB_NODE_HREF)
export function countHubNodes(hubFile) {
  return hubNodesIn(readHub('guides', hubFile))
}

// countHubChains — distinct chain pages (../chaingraph/chains/*.html) linked from a card on a
// guides/*-hub.html page. Third counter, not a slice of `nodes`: plan v2 §3b adjudicated
// swift-ledger-hub as 5 nodes AND 4 chain links, and its copy makes two separate claims
// ("5 free browser-based tools plus 3 workflows"). Folding chains into `nodes` would have
// measured 9 there and contradicted the adjudication.
export const hubChainsIn = (html) => countCards(html, CHAIN_CARD_CLASSES, HUB_CHAIN_HREF)
export function countHubChains(hubFile) {
  return hubChainsIn(readHub('guides', hubFile))
}

// countChainGuideNodes / countChainGuideChains — the same two families on a
// chaingraph/guide-*.html page, whose hrefs are relative to chaingraph/ (bare art-…/chains/…)
// and whose cards all carry class="card". Plan v2 §3c: countHubTools measures 0 on all 14 of
// these hubs that claim a count, and 13 of the 14 carry zero ../tools/ anchors of any class.
//
// ⚠ One correction to §3c's own numbers, measured here: §3c's per-hub figures were taken with an
// EXACT `class="card"` match, which misses every card carrying a second class token. Real markup
// on origin/main @ f8eb802f includes `class="card flagship"`, `class="card kyb"`,
// `class="card chain flagship"` and `class="card chain kyb"`. Token-splitting the class list (as
// countCards does) therefore moves two of §3c's 14 rows — see the checkoff. The RULE is §3c's;
// only its arithmetic was tightened.
export const chainGuideNodesIn = (html) => countCards(html, CHAIN_GUIDE_CARD_CLASSES, GUIDE_NODE_HREF)
export function countChainGuideNodes(guideFile) {
  return chainGuideNodesIn(readHub('chaingraph', guideFile))
}
export const chainGuideChainsIn = (html) => countCards(html, CHAIN_GUIDE_CARD_CLASSES, GUIDE_CHAIN_HREF)
export function countChainGuideChains(guideFile) {
  return chainGuideChainsIn(readHub('chaingraph', guideFile))
}

// The numeral a page's <meta name="description"> CLAIMS today, or null if it claims none.
// Regex is plan v2 §1a's measured detector — 5 filler words and alphanumeric-safe filler tokens,
// because the shipped check-count-prose.mjs form ({0,3} filler, [A-Za-z-]+ tokens) both
// under-counted ("8 free browser-based real-time payments tools" is four filler words) and
// MIS-READ ("All 21 Cat-11 tools" matched the substring "11 tools" and reported a claim of 11).
// First match only: the claim is the leading numeral of the sentence, not any later one.
const CLAIM_RE = /(\d[\d,]*)\+?\s+(?:[A-Za-z0-9][A-Za-z0-9-]*\s+){0,5}tools?\b/
export function claimedToolNumeral(html) {
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
  if (!meta) return null
  const m = meta[1].match(CLAIM_RE)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

// deriveHubCounts — EVERY hub, measured by a directory loop, not a hand-named constant list.
// The five constants this replaces (hubTools.dora/fraudRisk/sme/tradetech/capitalMarkets,
// CLAIMS-SENTINEL-TIER1-1) could not see the 48 other guides/*-hub.html pages or any of the 33
// chaingraph/guide-*.html pages at all. A hub added tomorrow is counted the day it lands, with
// no new rule and no new constant.
//
// Slug = the file's basename without .html. Collision-free across the two directories by
// construction: guides/ hubs all end -hub, chaingraph/ hubs all begin guide-.
export function deriveHubCounts() {
  const hubCounts = {}
  for (const file of readdirSync(resolve(repoRoot, 'guides')).filter(f => f.endsWith('-hub.html')).sort()) {
    const slug = file.replace(/\.html$/, '')
    hubCounts[slug] = {
      dir: 'guides',
      file: `guides/${file}`,
      tools: countHubTools(file),
      nodes: countHubNodes(file),
      chains: countHubChains(file),
      claimed: claimedToolNumeral(readHub('guides', file)),
    }
  }
  for (const file of readdirSync(resolve(repoRoot, 'chaingraph')).filter(f => /^guide-.+\.html$/.test(f)).sort()) {
    const slug = file.replace(/\.html$/, '')
    hubCounts[slug] = {
      dir: 'chaingraph',
      file: `chaingraph/${file}`,
      tools: countHubTools(file, 'chaingraph'),
      nodes: countChainGuideNodes(file),
      chains: countChainGuideChains(file),
      claimed: claimedToolNumeral(readHub('chaingraph', file)),
    }
  }
  return hubCounts
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
  const toolsHtml = readDerived('tools.html')
  const categories = (toolsHtml.match(/class="cat-heading"/g) || []).length

  // cat.* — per-category .tool-card counts in tools.html (TOOLSHTML-CATCOUNT-GATE-1).
  // Mirrors tools.html's own runtime counter exactly: only tags carrying
  // class="tool-card" count. The featured-callout divs and the cat-8 heading's own
  // data-cat attribute (both used for filter visibility, not counting) are excluded,
  // so cat.8 here and byCat['cat-8'] in the page agree by construction. Card keys are
  // "cat-N" / "mcp" / "rbe"; sentinels use the dot form ("cat.8", "cat.mcp", "cat.rbe")
  // because the <!--COUNT:...--> comment-sentinel regex forbids hyphens in keys.
  const catCounts = {}
  for (const m of toolsHtml.matchAll(/<[^>]*\bdata-cat="([^"]+)"[^>]*>/g)) {
    if (!/\bclass="[^"]*tool-card/.test(m[0])) continue
    const key = 'cat.' + m[1].replace(/^cat-/, '')
    catCounts[key] = (catCounts[key] || 0) + 1
  }

  // chains
  const chaingraph = JSON.parse(readDerived('chaingraph', 'chaingraph.json'))
  const chains = (chaingraph.chains ?? []).length

  // workflows.recipes — data rows in the workflows table in mcp.html
  const mcpHtml = readDerived('mcp.html')
  const wfStart = mcpHtml.indexOf('id="workflows"')
  const wfEnd   = mcpHtml.indexOf('</table>', wfStart)
  const wfSection = (wfStart !== -1 && wfEnd !== -1) ? mcpHtml.slice(wfStart, wfEnd) : ''
  const workflowsRecipes = (wfSection.match(/<tr><td>/g) || []).length

  // mcp.live — chaingraph live nodes + pilot widgets + utility tools
  const mcpCountsData = JSON.parse(readDerived('data', 'mcp-counts.json'))
  const liveNodes = (chaingraph.nodes ?? []).filter(n => n.status === 'live').length
  const mcpLive = liveNodes + mcpCountsData.pilot_widgets + mcpCountsData.utility_tools

  // chains.gated — chains with >=1 gated step (WHITEPAPER-CORRECTIONS-1; same derivation the
  // 2026-09-02 claims audit used to confirm the paper's "64 of them gated").
  const chainsGated = (chaingraph.chains ?? []).filter(c => (c.steps ?? []).some(s => s.gate)).length
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
  const chainL2SharedPass = l2Report.l2s['L2S-pass']
  const chainL2SharedFail = l2Report.l2s['L2S-fail']
  const chainL2SharedIndeterminate = l2Report.l2s['L2S-indeterminate']
  const chainL2SharedFields = l2Report.l2s.shared_fields_examined

  // webmcp.pages — chaingraph pages that REGISTER a WebMCP tool (a registerTool( call, the
  // construct itself), not pages that merely mention the API in prose; the whitepaper's own
  // §8.4 <code> mentions carry no registerTool( and are excluded by construction.
  const CGDIR = resolve(repoRoot, 'chaingraph')
  const webmcpPages = readdirSync(CGDIR)
    .filter(f => f.endsWith('.html'))
    .filter(f => readFileSync(resolve(CGDIR, f), 'utf8').includes('registerTool(')).length

  // hubCounts / hubTools.* — HUB-COUNT-COUNTERS-SSOT-1. One directory loop measures every hub
  // (tools, nodes, chains per slug); the five hubTools.* keys below are ALIASES onto it, kept so
  // no shipped sentinel or ATTR_RULE in scripts/lib/count-rules.mjs has to change. The alias
  // values are byte-identical to the five hand-named constants they replace: all five hubs' cards
  // use class="tool-card-link", so widening the class test to include tool-card cannot move them.
  const hubCounts = deriveHubCounts()
  const hubAlias = (slug) => hubCounts[slug]?.tools ?? 0

  // infra_pages — INFRA-PAGE-1: the derived page registry (data/infra-registry.json,
  // written by gen-infra-registry.mjs). infrastructure.html renders one card per
  // entry behind a data-count="infra_pages" sentinel; the count must re-derive
  // from the registry, never a hand-typed number.
  // MERGEGROUP-HARD-GATES-1: the registry IS a derived input — overlay-read it
  // like the other derived inputs above, or the merge_group Count-drift gate
  // compares the REGENERATED infrastructure.html (scratch sentinel, DERIVED_ROOT)
  // against the COMMITTED registry read here and reds on every tree where the
  // registry count legitimately moved (measured: PROMPT-LIBRARY-PAGE-2 added
  // prompts.html to the scope walk → scratch infra_pages=202 vs committed 201;
  // merge_group run 34648973207, "DRIFT infrastructure.html
  // data-count=infra_pages expected=201 got=202"). DERIVED_ROOT-unset
  // behaviour is byte-for-byte unchanged.
  let infraPages = 0
  try {
    infraPages = JSON.parse(readDerived('data', 'infra-registry.json')).length
  } catch { /* registry absent — sentinel stays unverified rather than guessing */ }

  // showcase_prompts — PROMPT-LIBRARY-PAGE-2: the prompt-library hero count
  // (prompts.html, written by gen-prompts-page.mjs from this same JSON) and
  // index.html's topic tile (verify-counts.mjs --fix regenerated now that the
  // key is registered), = the mcp/showcase-prompts.json entry count. Same SSOT
  // read (array-or-{prompts} envelope) as gen-prompts-page.mjs's loadPrompts,
  // so the sentinel sites cannot disagree with the generator or each other.
  // Authored input — repo-rooted read, never the overlay.
  let showcasePrompts = 0
  try {
    const rawShowcase = JSON.parse(readFileSync(resolve(repoRoot, 'mcp', 'showcase-prompts.json'), 'utf8'))
    const showcaseArr = Array.isArray(rawShowcase) ? rawShowcase : (Array.isArray(rawShowcase.prompts) ? rawShowcase.prompts : null)
    showcasePrompts = Array.isArray(showcaseArr) ? showcaseArr.length : 0
  } catch { /* SSOT absent — sentinel stays unverified rather than guessing */ }

  return {
    'tools.browser':     toolsBrowser,
    'manifests':         manifests,
    'guides.hubs':       guidesHubs,
    'categories':        categories,
    'chains':            chains,
    'workflows.recipes': workflowsRecipes,
    ...catCounts,
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
    'chainL2.sharedPass':          chainL2SharedPass,
    'chainL2.sharedFail':          chainL2SharedFail,
    'chainL2.sharedIndeterminate': chainL2SharedIndeterminate,
    'chainL2.sharedFields':        chainL2SharedFields,
    'nodes.live':        liveNodes,
    'chains.gated':      chainsGated,
    'webmcp.pages':      webmcpPages,
    'hubTools.dora':             hubAlias('dora-operational-resilience-hub'),
    'hubTools.fraudRisk':        hubAlias('fraud-risk-hub'),
    'hubTools.sme':              hubAlias('sme-financial-health-hub'),
    'hubTools.tradetech':        hubAlias('tradetech-hub'),
    'hubTools.capitalMarkets':   hubAlias('capital-markets-settlement-hub'),
    hubCounts,
    'infra_pages':       infraPages,
    'showcase_prompts':  showcasePrompts,
  }
}

// hubReportLines — one row per hub: slug, measured tools / nodes / chains, and the numeral its
// meta description CLAIMS today. The claim column is compared against tools for a guides/ hub and
// against nodes for a chaingraph/guide-* hub, because that is what each family's copy means by
// "N tools" (plan v2 §3b/§3c). A hub claiming nothing is "-" and is never a disagreement.
// Verdicts: agree · DISAGREE (claims a number nothing on the page measures) · no-claim.
export function hubReportLines(hubCounts = deriveHubCounts()) {
  const rows = []
  for (const [slug, h] of Object.entries(hubCounts)) {
    const basis = h.dir === 'guides' ? h.tools : h.nodes
    const verdict = h.claimed === null ? 'no-claim' : (h.claimed === basis ? 'agree' : 'DISAGREE')
    rows.push({ slug, ...h, basis, verdict })
  }
  const w = Math.max(...rows.map(r => r.slug.length), 4)
  const lines = [
    `${'slug'.padEnd(w)}  ${'dir'.padEnd(10)} tools  nodes chains claimed  verdict`,
    `${'-'.repeat(w)}  ${'-'.repeat(10)} -----  ----- ------ -------  -------`,
  ]
  for (const r of rows) {
    lines.push(
      `${r.slug.padEnd(w)}  ${r.dir.padEnd(10)} ${String(r.tools).padStart(5)}  ` +
      `${String(r.nodes).padStart(5)} ${String(r.chains).padStart(6)} ` +
      `${String(r.claimed ?? '-').padStart(7)}  ${r.verdict}`
    )
  }
  const disagree = rows.filter(r => r.verdict === 'DISAGREE')
  const noClaim = rows.filter(r => r.verdict === 'no-claim')
  lines.push('')
  lines.push(`${rows.length} hub(s): ${rows.length - disagree.length - noClaim.length} agree, ` +
    `${disagree.length} DISAGREE, ${noClaim.length} claim no number.`)
  if (disagree.length) {
    lines.push('DISAGREE set (claim vs the family its copy means):')
    for (const r of disagree) {
      lines.push(`  ${r.slug}: claims ${r.claimed}, measures ${r.basis} ` +
        `(tools=${r.tools} nodes=${r.nodes} chains=${r.chains})`)
    }
  }
  return lines
}

// When run directly: --report prints the per-hub table, otherwise JSON to stdout.
// The flag is deliberately --report and NOT a freshness flag: check-generator-coverage.mjs
// hard-fails any script whose source carries a quoted freshness-flag token unless that exact
// command is a live scripts/preflight.mjs GATES entry (measured — the first draft of this very
// comment named the flag in quotes and turned the gate red). This module is a library the gates
// read, not a gate; verify-counts.mjs is the gate over its values.
if (resolve(process.argv[1]) === resolve(__filename)) {
  if (process.argv.slice(2).includes('--report')) {
    process.stdout.write(hubReportLines().join('\n') + '\n')
  } else {
    const counts = await deriveCounts()
    process.stdout.write(JSON.stringify(counts, null, 2) + '\n')
  }
}
