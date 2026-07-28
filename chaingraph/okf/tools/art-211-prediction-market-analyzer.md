---
type: DecisionTool
title: "Prediction Market Analyzer"
description: "Computes prediction market PnL, implied probability, break-even, no-vig fair value, expected value, Kelly stake, and odds conversion for binary and scalar contracts. Covers Polymarket, Kalshi, CME Event, and Robinhood. Includes Brier and log-score forecast accuracy metrics. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.html
tags: ["event_market_pnl", "wave-36", "mcp:analyze_prediction_market"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-211-prediction-market-analyzer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.html
    title: "public tool page"
---

# Prediction Market Analyzer

> Exports a decision via MCP `analyze_prediction_market` — mandate type `event_market_pnl`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Prediction Market Arbitrage](./art-212-prediction-market-arbitrage.md)
