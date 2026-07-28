---
type: DecisionTool
title: "Cross-Border B2B Fee Calculator"
description: "Itemizes a single cross-border B2B invoice's total cost stack: FX spread cost, payment-method/correspondent fee, VAT or reverse-charge cost, documentary-credit cost, and reconciliation cost, plus total cost as a percentage of invoice value. Ports the calculation from tools/141-cross-border-b2b-fee-calculator.html into a provable kernel. VAT treatment, documentary-credit cost, and correspondent fees are caller-supplied, never vendored. Pairs with the already-shipped compare_corridor_cost node (art-249), which benchmarks a remittance corridor against World Bank RPW / SDG 10.c targets rather than itemizing a single invoice."
resource: https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.html
tags: ["analytics_mandate", "wave-63", "mcp:compute_cross_border_fees"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-367-compute-cross-border-fees.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.html
    title: "public tool page"
---

# Cross-Border B2B Fee Calculator

> Exports a decision via MCP `compute_cross_border_fees` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-367-compute-cross-border-fees.md) — §10.2.
