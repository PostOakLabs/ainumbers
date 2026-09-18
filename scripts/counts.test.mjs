#!/usr/bin/env node
/**
 * scripts/counts.test.mjs — HUB-COUNT-COUNTERS-SSOT-1 fixture proof for the hub card counters
 * in scripts/counts.mjs (countHubTools / countHubNodes / countHubChains /
 * countChainGuideNodes / countChainGuideChains, their pure *In siblings, claimedToolNumeral,
 * deriveHubCounts and hubReportLines).
 *
 * Why the fixtures are INLINE STRINGS and not files: guides/ and chaingraph/ are published
 * directories. A fixture hub dropped there would be a real page — picked up by the sitemap
 * generator, the dead-link gate, the nav-reachability gate and deriveHubCounts's own directory
 * loop. So every rule is proven against the pure html→number functions, and the file-reading
 * wrappers are proven separately by known-answer cases against REAL shipped pages (below),
 * which is also what keeps the two layers from drifting apart.
 *
 * Run: node scripts/counts.test.mjs
 */

import assert from 'assert'
import {
  hubToolsIn, hubNodesIn, hubChainsIn,
  chainGuideNodesIn, chainGuideChainsIn,
  countHubTools, countHubNodes, countHubChains,
  countChainGuideNodes, countChainGuideChains,
  claimedToolNumeral, deriveHubCounts, hubReportLines,
} from './counts.mjs'

let passed = 0
function check(label, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  passed++
}

const page = (body) => `<!DOCTYPE html><html><head><title>t</title></head><body>${body}</body></html>`

// ── 1. a hub with only tool cards ────────────────────────────────────────────
const ONLY_TOOLS = page(`
  <a class="tool-card-link" href="../tools/001-alpha.html">Alpha</a>
  <a class="tool-card-link" href="../tools/002-beta.html">Beta</a>
  <a class="tool-card-link" href="../tools/003-gamma.html">Gamma</a>
`)
check('only tool cards → tools', hubToolsIn(ONLY_TOOLS), 3)
check('only tool cards → nodes', hubNodesIn(ONLY_TOOLS), 0)
check('only tool cards → chains', hubChainsIn(ONLY_TOOLS), 0)

// ── 2. a hub with only node cards ────────────────────────────────────────────
// The noun ruling (RULINGS 2026-09-18T19:2xZ item 4): a ChainGraph node card is NOT a tool, so
// a page of nothing but node cards must measure tools=0 however its own copy reads.
const ONLY_NODES = page(`
  <a class="tool-card" href="../chaingraph/art-288-map-iso20022-to-evm-calldata.html">art-288</a>
  <a class="node-link" href="../chaingraph/art-289-lint-besu-settlement-contract.html">art-289</a>
  <a class="chain-card-link" href="../chaingraph/art-01-ap2-mandate-chain-validator.html">art-01</a>
`)
check('only node cards → tools is ZERO (noun ruling item 4)', hubToolsIn(ONLY_NODES), 0)
check('only node cards → nodes', hubNodesIn(ONLY_NODES), 3)
check('only node cards → chains', hubChainsIn(ONLY_NODES), 0)

// ── 3. a mixed hub: tools + nodes + chain pages, all three families at once ──
// Shape measured on guides/swift-ledger-hub.html and guides/tradetech-hub.html.
const MIXED = page(`
  <a class="tool-card-link" href="../tools/567-chargeback-evidence-bundle-composer.html">tool</a>
  <a class="tool-card" href="../chaingraph/art-385-agent-token-scope-checker.html">node</a>
  <a class="tool-card-link" href="../chaingraph/art-292-attest-settlement-orchestrator.html">node</a>
  <a class="workflow-link" href="../chaingraph/chains/agent-payment-dispute-evidence.html">chain</a>
  <a class="chain-link" href="../chaingraph/chains/intraday-finality-attestation.html">chain</a>
`)
check('mixed hub → tools', hubToolsIn(MIXED), 1)
check('mixed hub → nodes', hubNodesIn(MIXED), 2)
check('mixed hub → chains', hubChainsIn(MIXED), 2)

// ── 4. class="tool-card" markup is counted (plan v2 §3b's markup-zero class) ─
// The shipped rule required exactly class="tool-card-link" and measured 0 on four hubs.
const TOOL_CARD_MARKUP = page(`
  <a class="tool-card" href="../tools/544-vc2-issuance-composer.html">544</a>
  <a class="tool-card" href="../tools/545-sdjwt-disclosure-workbench.html">545</a>
`)
check('class="tool-card" cards count as tools', hubToolsIn(TOOL_CARD_MARKUP), 2)
// Attribute ORDER must not matter (hub pages ship both orders), and a second class token on the
// card must not hide it.
check('href-before-class order', hubToolsIn(page('<a href="../tools/1-a.html" class="tool-card">a</a>')), 1)
check('extra class token on a card', hubToolsIn(page('<a class="tool-card featured" href="../tools/1-a.html">a</a>')), 1)

// ── 5. a ../tools/ link OUTSIDE any card must NOT count ──────────────────────
// Measured twice in plan v2 §3a: payment-scheme-network has 16 raw ../tools/ links but 14 in a
// card; treasury-liquidity 19 raw, 18 in a card.
const NAV_NOISE = page(`
  <nav><a href="../tools/001-alpha.html">All tools</a>
       <a class="nav-link" href="../tools/002-beta.html">Beta</a>
       <a class="related-card" href="../tools.html#cat-29">Related</a></nav>
  <a class="tool-card-link" href="../tools/003-gamma.html">Gamma</a>
`)
check('nav/prose ../tools/ links are not cards', hubToolsIn(NAV_NOISE), 1)
check('related-card is not a tool card', hubToolsIn(page('<a class="related-card" href="../tools/1-a.html">a</a>')), 0)

// ── 6. a duplicate href counts ONCE ──────────────────────────────────────────
const DUPES = page(`
  <a class="tool-card-link" href="../tools/001-alpha.html">hero card</a>
  <a class="tool-card-link" href="../tools/001-alpha.html">same tool, second card</a>
  <a class="tool-card" href="../chaingraph/art-98-mica-casp-fit-diagnostic.html">node</a>
  <a class="node-link" href="../chaingraph/art-98-mica-casp-fit-diagnostic.html">same node</a>
  <a class="workflow-link" href="../chaingraph/chains/mica-fit.html">chain</a>
  <a class="chain-link" href="../chaingraph/chains/mica-fit.html">same chain</a>
`)
check('duplicate tool href counts once', hubToolsIn(DUPES), 1)
check('duplicate node href counts once', hubNodesIn(DUPES), 1)
check('duplicate chain href counts once', hubChainsIn(DUPES), 1)

// ── 7. chaingraph/guide-* rules (plan v2 §3c) ────────────────────────────────
// Hrefs there are relative to chaingraph/ (bare art-…/chains/…), and one class carries both
// families. Multi-token class lists (card flagship / card chain kyb) are real markup and MUST
// be seen — measuring them with an exact class="card" match is what moved two of §3c's rows.
const CHAIN_GUIDE = page(`
  <a class="card" href="art-98-mica-casp-fit-diagnostic.html">art-98</a>
  <a class="card flagship" href="art-100-mica-casp-authorization-readiness.html">art-100</a>
  <a class="card kyb" href="art-268-compute-cdd-ownership-25pct.html">art-268</a>
  <a class="card chain" href="chains/mica-fit.html">chain</a>
  <a class="card chain flagship" href="chains/mica-casp-authorization.html">chain</a>
  <a class="nav-link" href="art-999-not-a-card.html">nav</a>
  <a class="card" href="../guides/mica-crypto-asset-regulation-hub.html">sibling hub</a>
`)
check('chain-guide nodes (multi-token class lists seen)', chainGuideNodesIn(CHAIN_GUIDE), 3)
check('chain-guide chains', chainGuideChainsIn(CHAIN_GUIDE), 2)
check('chain-guide node link outside a card is not counted', chainGuideNodesIn(page('<a class="nav-link" href="art-1-x.html">x</a>')), 0)
check('a sibling-hub href is neither a node nor a chain', chainGuideNodesIn(page('<a class="card" href="../guides/x-hub.html">x</a>')), 0)
// A ChainGraph page with no art number is not a node page. guides/intoto-attestations-hub.html
// ships exactly this shape, and it is why that hub measures 0 in both families.
check('non-art ../chaingraph/ page is not a node', hubNodesIn(page('<a class="tool-card" href="../chaingraph/intoto-layout-composer.html">x</a>')), 0)

// ── 8. claimedToolNumeral — plan v2 §1a's two detector holes must stay closed ─
const meta = (content) => `<html><head><meta name="description" content="${content}"></head><body></body></html>`
check('no description → null', claimedToolNumeral('<html><head></head><body>9 tools</body></html>'), null)
check('description with no claim → null', claimedToolNumeral(meta('Trade finance hub for LC validation.')), null)
check('simple claim', claimedToolNumeral(meta('12 free browser-based DORA compliance tools covering ICT risk.')), 12)
// Hole 1: the shipped detector allows at most THREE filler words, so these two were invisible.
check('four filler words (realtime-payments-ops shape)', claimedToolNumeral(meta('8 free browser-based real-time payments tools for ops teams.')), 8)
check('four filler words (regulatory-compliance-consent shape)', claimedToolNumeral(meta('14 free browser-based regulatory compliance tools.')), 14)
// Hole 2: the shipped detector cannot span an alphanumeric token, so it matched the SUBSTRING
// "11 tools" and reported 11 where the page claims 21.
check('alphanumeric filler token (dlt-tokenization "All 21 Cat-11 tools")', claimedToolNumeral(meta('All 21 Cat-11 tools for tokenization.')), 21)
check('leading numeral wins, not a later one', claimedToolNumeral(meta('7 free tools plus 3 workflows and 12 tools elsewhere.')), 7)
check('thousands separator', claimedToolNumeral(meta('1,185 client-side fintech tools.')), 1185)
check('trailing plus', claimedToolNumeral(meta('590+ browser-based fintech tools.')), 590)
check('singular "tool"', claimedToolNumeral(meta('1 free browser-based tool.')), 1)

// ── 9. known answers against REAL shipped pages (proves the file wrappers, the
//       directory loop, and the aliases — not just the pure functions) ────────
// Every figure below is adjudicated in plan v2 §3a/§3b/§3c. A change to a hub page moves one of
// these, which is the point: the counter is measured against the corpus it will gate.
check('real: credential-workbench-hub tools (§3b, the class-name-only defect)', countHubTools('credential-workbench-hub.html'), 2)
check('real: agent-payment-dispute-evidence-hub tools (§3b: 1 tool …)', countHubTools('agent-payment-dispute-evidence-hub.html'), 1)
check('real: agent-payment-dispute-evidence-hub nodes (§3b: … + 2 nodes)', countHubNodes('agent-payment-dispute-evidence-hub.html'), 2)
check('real: swift-ledger-hub nodes (§3b: 5 nodes, count correct)', countHubNodes('swift-ledger-hub.html'), 5)
check('real: swift-ledger-hub chains (§3b: 4 links, its copy says 3)', countHubChains('swift-ledger-hub.html'), 4)
check('real: swift-ledger-hub tools is ZERO (its "5 tools" are nodes)', countHubTools('swift-ledger-hub.html'), 0)
check('real: dora-operational-resilience-hub tools (§3a agree)', countHubTools('dora-operational-resilience-hub.html'), 12)
check('real: payment-scheme-network-hub tools (§3a: 16 raw links, 14 in a card)', countHubTools('payment-scheme-network-hub.html'), 14)
check('real: guide-ai-governance nodes (§3c agree)', countChainGuideNodes('guide-ai-governance.html'), 9)
check('real: guide-ai-governance chains (§3c: 11 card-chain anchors)', countChainGuideChains('guide-ai-governance.html'), 11)
check('real: guide-mortgage-compliance nodes (§3c DISAGREE, claims 6)', countChainGuideNodes('guide-mortgage-compliance.html'), 14)

// ── 10. the directory loop and the five aliases ──────────────────────────────
const hubCounts = deriveHubCounts()
const slugs = Object.keys(hubCounts)
assert.ok(slugs.length > 80, `deriveHubCounts covered only ${slugs.length} hubs — the loop lost a directory`)
passed++
check('loop covers both directories', [
  hubCounts['dora-operational-resilience-hub']?.dir,
  hubCounts['guide-ai-governance']?.dir,
], ['guides', 'chaingraph'])
// Every hub in both published directories is present — the whole point of replacing the five
// hand-named constants. Derived from the same directories, so a hub added tomorrow is covered.
for (const [slug, h] of Object.entries(hubCounts)) {
  assert.ok(Number.isInteger(h.tools) && Number.isInteger(h.nodes) && Number.isInteger(h.chains),
    `${slug}: non-integer count in ${JSON.stringify(h)}`)
  assert.ok(h.claimed === null || Number.isInteger(h.claimed), `${slug}: bad claimed ${h.claimed}`)
}
passed++
// The five shipped sentinel keys are aliases onto the loop, and they are the TOOL count only.
for (const [slug, expectedKey] of [
  ['dora-operational-resilience-hub', 'hubTools.dora'],
  ['fraud-risk-hub', 'hubTools.fraudRisk'],
  ['sme-financial-health-hub', 'hubTools.sme'],
  ['tradetech-hub', 'hubTools.tradetech'],
  ['capital-markets-settlement-hub', 'hubTools.capitalMarkets'],
]) {
  assert.ok(hubCounts[slug], `alias source hub missing from the loop: ${slug} (${expectedKey})`)
  assert.strictEqual(hubCounts[slug].tools, countHubTools(`${slug}.html`),
    `${expectedKey}: loop value disagrees with countHubTools(${slug}.html)`)
}
passed++
// tradetech-hub is the calibration case for the noun ruling: it ships all three families, and
// its sentinel must stay on the browser-tool count (11) and never absorb its 7 nodes.
check('tradetech-hub families stay separate', [
  hubCounts['tradetech-hub'].tools, hubCounts['tradetech-hub'].nodes, hubCounts['tradetech-hub'].chains,
], [11, 7, 3])

// ── 11. hubReportLines verdicts ──────────────────────────────────────────────
const report = hubReportLines({
  'a-hub': { dir: 'guides', file: 'guides/a-hub.html', tools: 5, nodes: 0, chains: 0, claimed: 5 },
  'b-hub': { dir: 'guides', file: 'guides/b-hub.html', tools: 5, nodes: 0, chains: 0, claimed: 7 },
  'c-hub': { dir: 'guides', file: 'guides/c-hub.html', tools: 5, nodes: 0, chains: 0, claimed: null },
  // a chaingraph/guide-* hub's claim is compared against NODES, not tools (§3c)
  'guide-d': { dir: 'chaingraph', file: 'chaingraph/guide-d.html', tools: 0, nodes: 4, chains: 8, claimed: 4 },
}).join('\n')
assert.ok(/a-hub\s+guides\s+5\s+0\s+0\s+5\s+agree/.test(report), 'a-hub should read agree:\n' + report)
assert.ok(/b-hub\s+guides\s+5\s+0\s+0\s+7\s+DISAGREE/.test(report), 'b-hub should read DISAGREE:\n' + report)
assert.ok(/c-hub\s+guides\s+5\s+0\s+0\s+-\s+no-claim/.test(report), 'c-hub should read no-claim:\n' + report)
assert.ok(/guide-d\s+chaingraph\s+0\s+4\s+8\s+4\s+agree/.test(report), 'guide-d claim compares against nodes:\n' + report)
assert.ok(report.includes('4 hub(s): 2 agree, 1 DISAGREE, 1 claim no number.'), 'summary line wrong:\n' + report)
assert.ok(report.includes('b-hub: claims 7, measures 5 (tools=5 nodes=0 chains=0)'), 'disagreement detail wrong:\n' + report)
passed += 6

console.log(`counts.test.mjs PASS — ${passed} assertion group(s), ${slugs.length} hubs measured by the directory loop`)
