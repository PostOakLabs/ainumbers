---
type: DecisionTool
title: "VaR Backtesting Traffic-Light Zone Calculator"
description: "Counts Basel VaR backtesting exceptions (actual daily P&L loss exceeding the model's 1-day VaR estimate) over a rolling up-to-250-trading-day window, then looks up the green/yellow/red traffic-light zone and capital multiplier per the Basel Committee's 1996 Amendment to the Capital Accord to Incorporate Market Risks, Part V, retained under BCBS d457 (Jan 2019) internal-models-approach backtesting. Exception-count plus zone plus multiplier lookup only -- does NOT compute VaR itself and does NOT apply the multiplier to a capital charge."
resource: https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.html
tags: ["capital_assessment", "wave-70", "mcp:compute_var_backtest_traffic_light"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-429-var-backtest-traffic-light.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.html
    title: "public tool page"
---

# VaR Backtesting Traffic-Light Zone Calculator

> Exports a decision via MCP `compute_var_backtest_traffic_light` — mandate type `capital_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-429-var-backtest-traffic-light.md) — §10.2.
