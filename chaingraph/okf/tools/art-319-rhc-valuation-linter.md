---
type: DecisionTool
title: "Valuation Double-Count / Decimal Linter"
description: "Lints Robinhood Chain stock-token USD valuation expressions for the double-count bug: the Chainlink price feed already includes corporate actions, so multiplying raw balance by price and then by uiMultiplier applies the same corporate action twice. Compares the tested valuation against the correct expression and flags the double-count when present, with the corrected formula returned. High hit-rate node for any developer writing a valuation path against 18-decimal stock tokens and an 8-decimal feed. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html
tags: ["collateral_mandate", "wave-56", "mcp:lint_stock_token_valuation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-319-rhc-valuation-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html
    title: "public tool page"
---

# Valuation Double-Count / Decimal Linter

> Exports a decision via MCP `lint_stock_token_valuation` — mandate type `collateral_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
