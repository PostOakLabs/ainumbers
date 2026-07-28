---
type: DecisionTool
title: "Perp Margin and Liquidation Calculator"
description: "Computes perp liquidation price, margin health, buffer, and distance to liquidation for isolated and cross-margin modes. Covers Hyperliquid, dYdX v4, Binance, GMX, and generic venues. Includes portfolio-margin spot-offset and cross-margin efficiency calculation. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.html
tags: ["derivatives_margin_health", "wave-36", "mcp:compute_perp_margin"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-213-perp-liquidation-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.html
    title: "public tool page"
---

# Perp Margin and Liquidation Calculator

> Exports a decision via MCP `compute_perp_margin` — mandate type `derivatives_margin_health`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Perp Position Lifecycle](./art-214-perp-position-lifecycle.md)

## Attested computation

[executor + attester binding](../computations/art-213-perp-liquidation-calculator.md) — §10.2.
