---
type: DecisionTool
title: "Perp Position Lifecycle"
description: "Models a full perp position from open to close: liquidation price, realized PnL, cumulative funding over the holding period, taker and maker fees, and margin return. Hyperliquid hourly funding cadence default. Static-string timestamps. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-214-perp-position-lifecycle.html
tags: ["derivatives_margin_health", "wave-36", "mcp:model_perp_position"]
timestamp: 2026-07-14
---

# Perp Position Lifecycle

> Exports a decision via MCP `model_perp_position` — mandate type `derivatives_margin_health`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-214-perp-position-lifecycle.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Perp Margin and Liquidation Calculator](./art-213-perp-liquidation-calculator.md)

**Feeds:** _terminal node_
