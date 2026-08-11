---
type: DecisionTool
title: "Currency Basket Index"
description: "Values a currency basket by the fixed-amount method, where currency amounts are fixed at a rebase date and the live weights float daily with FX, and gives that valuation its own citable execution_hash. Two modes. Valuation takes amounts already fixed and returns the index value as the sum of amount times USD rate, each component's live weight as its share of that total, and its drift from any stated target weight. Derivation is the non-obvious arithmetic this node owns: given target weights, a rebase-date index value and the rebase-date FX rates, it derives the fixed amounts that those weights imply, then values them at today's rates, so amounts are an output of the rebase rather than an input to it. Target weights that do not sum to one are refused rather than silently normalized, since a basket derived from them is not a basket. Integer-quantity baskets are supported through an amount scale. Per-pair rates may cite the upstream oracle prints they came from, which populates the chain parent hashes without entering the hash preimage. HARD FENCE: every FX rate, fixed amount and target weight is supplied and asserted, never fetched (zero-egress); this computes what the stated method yields on the stated numbers, never that those numbers are the correct rates for the stated date, and never a live basket publication."
resource: https://ainumbers.co/chaingraph/art-561-currency-basket-index.html
tags: ["currency_basket_index", "wave-91", "mcp:currency_basket_index"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-561-currency-basket-index.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-561-currency-basket-index.html
    title: "public tool page"
---

# Currency Basket Index

> Exports a decision via MCP `currency_basket_index` — mandate type `currency_basket_index`.

**Context:** No statutory deadline; basket valuation follows the basket's own rebase and publication cycle, not a filing calendar.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-561-currency-basket-index.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Oracle Price Aggregation](./art-560-oracle-price-aggregation.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-561-currency-basket-index.md) — §10.2.
