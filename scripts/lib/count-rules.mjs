#!/usr/bin/env node
/**
 * scripts/lib/count-rules.mjs — verify-counts.mjs's ATTR_RULES table, extracted
 * verbatim (no rule changes) into a side-effect-free module so TWO consumers
 * read ONE table:
 *
 *   1. scripts/verify-counts.mjs — executes it (--check / --fix).
 *   2. scripts/gen-infra-registry.mjs — derives its description-rewrite
 *      exemption from it (REGEN-INFRA-REGISTRY-READBACK-CYCLE-1).
 *
 * Why the table must be shared: the 'counts' COVERED entry runs AFTER
 * 'infra-registry' in the regen pass (infra-registry → infrastructure-page →
 * counts; check-derived-fanout-coverage.mjs enforces that order), and --fix
 * rewrites the count digits inside some pages' meta/og/twitter/schema.org/
 * JSON-LD descriptions. The registry scans those same descriptions. A page
 * whose description verify-counts rewrites can therefore never be scanned
 * byte-stably by the registry within one pass — a true read-back cycle, which
 * no COVERED ordering can close (measured on main: #1879 moved the chain count
 * 369→368 and every Derived Artifacts Regen since 20:13Z refused the
 * non-fixpoint). The only cut is the READ: gen-infra-registry.mjs exempts
 * exactly the files descriptionRuleFiles() yields, so a FUTURE count rule that
 * adds another *description* sentinel extends the exemption automatically
 * instead of silently re-opening the cycle.
 */

// ── Attribute / JSON / text rules ────────────────────────────────────────────
//
// Each rule: { file, key, label, regex }
//   regex  — regex to find the count occurrence; group = capture group index (1-based)
//   flags  — optional regex flags (default 'g')
//
// --fix mode: replaces the captured group with the expected value.
// --check mode: reports expected vs got.

export const ATTR_RULES = [
  // ── docs/index.html ─────────────────────────────────────────────────────
  { file: 'docs/index.html', key: 'tools.browser', label: 'meta description',
    regex: /(content="Developer documentation[^"]*?\. MCP-native[^"]*?\. )(\d+)( browser-based)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'meta description (mcp.live)',
    regex: /(content="Developer documentation[^"]*?\. MCP-native[^"]*?\. \d+ browser-based[^"]*?\()(\d+)( live on the MCP)/,
  },
  { file: 'docs/index.html', key: 'tools.browser', label: 'og:description',
    regex: /(content="MCP-native, OpenAPI-documented[^"]*?suite\. )(\d+)( tools)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'og:description (mcp.live)',
    regex: /(content="MCP-native, OpenAPI-documented[^"]*?suite\. \d+ tools \()(\d+)( live)/,
  },
  { file: 'docs/index.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \"MCP-native, OpenAPI-documented[^"]*?suite\. )(\d+)( tools,)/,
  },
  { file: 'docs/index.html', key: 'mcp.live', label: 'schema.org description (mcp.live)',
    regex: /(\"description\": \"MCP-native, OpenAPI-documented[^"]*?suite\. \d+ tools, )(\d+)( live)/,
  },

  // ── index.html (head meta/title — body text uses comment sentinels) ──────
  { file: 'index.html', key: 'tools.browser', label: 'meta description',
    regex: /(content=")(\d+)( browser-based fintech tools and )/,
  },
  { file: 'index.html', key: 'chains', label: 'meta description (chains)',
    regex: /(content="\d+ browser-based fintech tools and )(\d+)( MCP-callable, hash-anchored OpenChainGraph workflows)/,
  },
  { file: 'index.html', key: 'tools.browser', label: 'og:description',
    regex: /(content=")(\d+)( free browser-based fintech tools and )/,
  },
  { file: 'index.html', key: 'chains', label: 'og:description (chains)',
    regex: /(content="\d+ free browser-based fintech tools and )(\d+)( MCP-callable OpenChainGraph workflows)/,
  },
  // twitter:description was removed from index.html in the hub-spoke rewrite — sentinel dropped
  // (it was a silent NO-MATCH). Re-add a row here if the tag returns.
  { file: 'index.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \")(\d+)( browser-based fintech tools and )/,
  },
  { file: 'index.html', key: 'chains', label: 'schema.org description (chains)',
    regex: /(\"description\": \"\d+ browser-based fintech tools and )(\d+)( hash-anchored, MCP-callable OpenChainGraph workflows)/,
  },
  { file: 'index.html', key: 'chains', label: 'machine-discovery link title',
    regex: /(title="OpenChainGraph machine index \()(\d+)( chains\)")/,
  },

  // ── sitemap.html ─────────────────────────────────────────────────────────
  { file: 'sitemap.html', key: 'tools.browser', label: 'LLMEO comment text',
    regex: /(║  • )(\d+)( free tools, all client-side)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'title',
    regex: /(<title>Sitemap \| AINumbers\.co: )(\d+)( Free Fintech Tools<\/title>)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'meta description',
    regex: /(content="Complete sitemap of AINumbers\.co\. )(\d+)( free browser-based)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'og:title',
    regex: /(content="Sitemap \| AINumbers\.co: )(\d+)( Free Fintech Tools")/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'og:description',
    regex: /(content="Every tool, every page\. )(\d+)( free browser-based)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'twitter:title',
    regex: /(content="Sitemap \| AINumbers\.co: )(\d+)( Free Fintech Tools")/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org description',
    regex: /(\"description\": \")(\d+)( free browser-based fintech tools for payments engineers)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org numberOfItems',
    regex: /(\"numberOfItems\": )(\d+)(,)/,
  },
  { file: 'sitemap.html', key: 'tools.browser', label: 'schema.org ItemList description',
    regex: /(\"description\": \"All )(\d+)( free fintech tools)/,
  },

  // ── mcp.html (head meta/title/JSON-LD/hero — S4 count-drift fix) ─────────
  { file: 'mcp.html', key: 'manifests', label: 'title',
    regex: /(<title>MCP Server \| AINumbers\.co: Connect )(\d+)(\+ Fintech Tools)/,
  },
  { file: 'mcp.html', key: 'mcp.live', label: 'meta description',
    regex: /(content="Official documentation for the AINumbers MCP server at mcp\.ainumbers\.co\/mcp: )(\d+)( tools, )/,
  },
  { file: 'mcp.html', key: 'mcp.widgets', label: 'meta description (widgets)',
    regex: /(content="Official documentation for the AINumbers MCP server at mcp\.ainumbers\.co\/mcp: \d+ tools, )(\d+)( interactive widgets, catalog search across )/,
  },
  { file: 'mcp.html', key: 'manifests', label: 'meta description (catalog)',
    regex: /(content="Official documentation for the AINumbers MCP server at mcp\.ainumbers\.co\/mcp: \d+ tools, \d+ interactive widgets, catalog search across )(\d+)( deterministic client-side fintech tools)/,
  },
  { file: 'mcp.html', key: 'mcp.live', label: 'og:description',
    regex: /(content="Connect https:\/\/mcp\.ainumbers\.co\/mcp to Claude, ChatGPT, or any MCP host: )(\d+)( read-only tools, )/,
  },
  { file: 'mcp.html', key: 'mcp.widgets', label: 'og:description (widgets)',
    regex: /(content="Connect https:\/\/mcp\.ainumbers\.co\/mcp to Claude, ChatGPT, or any MCP host: \d+ read-only tools, )(\d+)( interactive widgets, catalog search across )/,
  },
  { file: 'mcp.html', key: 'manifests', label: 'og:description (catalog)',
    regex: /(content="Connect https:\/\/mcp\.ainumbers\.co\/mcp to Claude, ChatGPT, or any MCP host: \d+ read-only tools, \d+ interactive widgets, catalog search across )(\d+)( fintech tools\. No auth)/,
  },
  { file: 'mcp.html', key: 'mcp.live', label: 'twitter:description',
    regex: /(content=")(\d+)( read-only MCP tools and \d+ interactive widgets for fintech work)/,
  },
  { file: 'mcp.html', key: 'mcp.widgets', label: 'twitter:description (widgets)',
    regex: /(content="\d+ read-only MCP tools and )(\d+)( interactive widgets for fintech work)/,
  },
  { file: 'mcp.html', key: 'mcp.live', label: 'JSON-LD description',
    regex: /(\"description\": \"Model Context Protocol server exposing )(\d+)( read-only fintech tools: )/,
  },
  { file: 'mcp.html', key: 'mcp.widgets', label: 'JSON-LD description (widgets)',
    regex: /(\"description\": \"Model Context Protocol server exposing \d+ read-only fintech tools: )(\d+)( interactive MCP Apps widgets)/,
  },
  { file: 'mcp.html', key: 'manifests', label: 'JSON-LD description (catalog)',
    regex: /(MCP developer tooling\) plus catalog search across )(\d+)( deterministic, client-side tools)/,
  },
  { file: 'mcp.html', key: 'manifests', label: 'hero-desc catalog count',
    regex: /(class="hero-desc">Connect the AINumbers MCP server[^<]*?catalog-search tool covers all )(\d+)( tools with one-click prefill)/,
  },
  { file: 'mcp.html', key: 'mcp.live', label: 'hero-badge tool count',
    regex: /(<span class="hero-badge badge-teal">)(\d+)( Tools · \d+ Widgets<\/span>)/,
  },
  { file: 'mcp.html', key: 'mcp.widgets', label: 'hero-badge widget count',
    regex: /(<span class="hero-badge badge-teal">\d+ Tools · )(\d+)( Widgets<\/span>)/,
  },
  { file: 'mcp.html', key: 'manifests', label: 'hero-desc catalog count',
    regex: /(<p class="hero-desc">[^<]*?catalog-search tool covers all )(\d+)( tools with one-click)/,
  },

  // ── about.html (og/twitter descriptions — hardcoded, not comment-sentinel) ─
  { file: 'about.html', key: 'tools.browser', label: 'og:description',
    regex: /(content="Deterministic, privacy-first fintech tools: )(\d+)(\+ browser-based calculators, validators and simulators across )/,
  },
  { file: 'about.html', key: 'categories', label: 'og:description (categories)',
    regex: /(content="Deterministic, privacy-first fintech tools: \d+\+ browser-based calculators, validators and simulators across )(\d+)( categories\. Built by Post Oak Labs)/,
  },
  { file: 'about.html', key: 'tools.browser', label: 'twitter:description',
    regex: /(content="Deterministic, privacy-first fintech tools by Post Oak Labs\. )(\d+)(\+ tools, zero PII, all client-side)/,
  },

  // ── mcp.html (stat table prose — hardcoded, not comment-sentinel) ────────
  { file: 'mcp.html', key: 'manifests', label: 'list_ainumbers_tools table cell',
    regex: /(<td>Search the full AINumbers catalog \()(\d+)(\+ client-side fintech tools\)\. Returns deep-links)/,
  },

  // ── guides/*-hub.html (meta/og/JSON-LD — attribute/JSON contexts, comment sentinels can't
  //    live there; the hero-desc + sec-heading + last-reviewed + sec-sub copies on these same
  //    pages use the HTML comment-sentinel form instead, see the checkHtmlSentinels() file list
  //    below — CLAIMS-SENTINEL-TIER1-1 audit Q7; tradetech-hub.html is the audit's named "×4
  //    copies" hub, dora/fraud-risk/sme carry the same meta/og/JSON-LD shape) ─────────────────
  { file: 'guides/tradetech-hub.html', key: 'hubTools.tradetech', label: 'meta description',
    regex: /(content=")(\d+)( browser-based tools covering the full trade finance lifecycle: MT700)/,
  },
  { file: 'guides/tradetech-hub.html', key: 'hubTools.tradetech', label: 'og:description',
    regex: /(content=")(\d+)( browser-based tools covering the full trade finance lifecycle: LC validation)/,
  },
  { file: 'guides/tradetech-hub.html', key: 'hubTools.tradetech', label: 'JSON-LD description',
    regex: /(\"description\":\")(\d+)( browser-based tools covering the full trade finance lifecycle — MT700)/,
  },
  { file: 'guides/dora-operational-resilience-hub.html', key: 'hubTools.dora', label: 'meta description',
    regex: /(content=")(\d+)( free browser-based DORA compliance tools covering ICT risk gap analysis)/,
  },
  { file: 'guides/dora-operational-resilience-hub.html', key: 'hubTools.dora', label: 'og:description',
    regex: /(content=")(\d+)( free browser-based DORA compliance tools covering the full EU 2022\/2554 framework)/,
  },
  { file: 'guides/dora-operational-resilience-hub.html', key: 'hubTools.dora', label: 'JSON-LD description',
    regex: /(\"description\":\")(\d+)( free browser-based DORA compliance tools covering the full EU 2022\/2554 framework)/,
  },
  { file: 'guides/fraud-risk-hub.html', key: 'hubTools.fraudRisk', label: 'meta description',
    regex: /(content=")(\d+)( free browser-based fraud detection and risk tools covering synthetic identity scoring)/,
  },
  { file: 'guides/fraud-risk-hub.html', key: 'hubTools.fraudRisk', label: 'og:description',
    regex: /(content=")(\d+)( free browser-based tools for fraud analysts, risk officers)/,
  },
  { file: 'guides/fraud-risk-hub.html', key: 'hubTools.fraudRisk', label: 'JSON-LD description',
    regex: /(\"description\":\")(\d+)( free browser-based fraud detection and risk tools for fraud analysts)/,
  },
  { file: 'guides/sme-financial-health-hub.html', key: 'hubTools.sme', label: 'meta description',
    regex: /(content=")(\d+)( free browser-based SME financial health tools covering credit risk scoring)/,
  },
  { file: 'guides/sme-financial-health-hub.html', key: 'hubTools.sme', label: 'og:description',
    regex: /(content=")(\d+)( browser-based SME financial health tools covering CCC, DSCR scoring)/,
  },
  { file: 'guides/sme-financial-health-hub.html', key: 'hubTools.sme', label: 'JSON-LD description',
    regex: /(\"description\":\")(\d+)( free browser-based SME financial health and lending readiness tools)/,
  },

  // ── JSON machine files ───────────────────────────────────────────────────
  { file: 'mcp/server.json', key: 'tools.browser', label: 'tool_count',
    regex: /(\"tool_count\": )(\d+)/,
  },
  { file: '.well-known/mcp/server.json', key: 'tools.browser', label: 'tool_count',
    regex: /(\"tool_count\": )(\d+)/,
  },
  { file: '.well-known/mcp.json', key: 'tools.browser', label: 'ainumbers-fintech-suite tool_count',
    regex: /(\"id\": \"ainumbers-fintech-suite\"[^}]*?\"tool_count\": )(\d+)/s,
  },
  { file: '.well-known/mcp.json', key: 'mcp.live', label: 'ainumbers-apps tool_count',
    regex: /(\"id\": \"ainumbers-apps\"[^}]*?\"tool_count\": )(\d+)/s,
  },
]

/**
 * Files carrying at least one *description* rule above — i.e. pages whose
 * meta/og/twitter/schema.org/JSON-LD description `verify-counts --fix`
 * rewrites. This is the infra-registry's exemption set
 * (REGEN-INFRA-REGISTRY-READBACK-CYCLE-1): the registry scans those
 * descriptions BEFORE 'counts' rewrites them in the same pass, so scanning
 * them back can never be a fixpoint. Derived, not hand-listed: a future
 * description-sentinel row added to ATTR_RULES extends this set (and with it
 * the exemption) in the same diff, by construction.
 */
export function descriptionRuleFiles(rules = ATTR_RULES) {
  const files = new Set()
  for (const rule of rules) {
    if (/description/i.test(rule.label)) files.add(rule.file)
  }
  return files
}
