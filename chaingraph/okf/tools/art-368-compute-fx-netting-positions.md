---
type: DecisionTool
title: "Multilateral FX Netting Calculator"
description: "Multilateral FX netting across up to 8 currencies: nets each currency's payable/receivable exposures in FCY, converts to USD at a caller-supplied spot-plus-forward-points effective rate, and returns gross volume, net volume, netting efficiency, estimated settlement savings, and per-currency residual position with an approximate 95%-confidence VaR. Ports the calculation from tools/105-fx-netting-simulator.html into a provable kernel. Spot rates, forward points, and 30-day volatility are caller-supplied reference data, never vendored."
resource: https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.html
tags: ["analytics_mandate", "wave-63", "mcp:compute_fx_netting_positions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-368-compute-fx-netting-positions.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.html
    title: "public tool page"
---

# Multilateral FX Netting Calculator

> Exports a decision via MCP `compute_fx_netting_positions` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
