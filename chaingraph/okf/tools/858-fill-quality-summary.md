---
type: DecisionTool
title: "Fill Quality Summary"
description: "Summarises the fill quality of one order from the fills the caller declares, in exact integer arithmetic. Given the order side and target quantity, a currency from a closed ISO 4217 table, an optional price scale of 0 to 8 decimals (default: the currency's minor unit), up to 5,000 fills, a declared market volume with its window label, and the counts of orders placed and cancelled, it returns the filled and unfilled quantity, the fill rate, the volume-weighted average price with its exact signed residual (sum of price times quantity minus VWAP times filled quantity, so the rounding is visible), participation against the declared market volume, the share of the fill that came from auctions, the cancel ratio, and the order-to-trade ratio (orders placed divided by fills count, which mixes an order count with an execution count). Prices and quantities are integer strings; rates and ratios are strings with two decimals, rounded half away from zero. Every refused field is named and no figure is computed on a refusal; participation is never shown above 100%. A calculation check on caller-declared fills and market volume, not investment advice and not a best-execution determination. No market data is fetched; the market volume and its window are the caller's declaration. It computes no arrival shortfall and no opportunity cost."
resource: https://ainumbers.co/chaingraph/858-fill-quality-summary.html
tags: ["compliance_control", "wave-153", "mcp:summarize_fill_quality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/858-fill-quality-summary.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/858-fill-quality-summary.html
    title: "public tool page"
---

# Fill Quality Summary

> Exports a decision via MCP `summarize_fill_quality` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/858-fill-quality-summary.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/858-fill-quality-summary.md) — §10.2.
