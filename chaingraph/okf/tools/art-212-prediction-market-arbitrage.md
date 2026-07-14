---
type: DecisionTool
title: "Prediction Market Arbitrage"
description: "Calculates cross-venue prediction market arbitrage: gross spread, fee-adjusted net edge, required capital, and minimum spread to survive fees. Covers Polymarket, Kalshi, SX Bet, and Robinhood. A 6% gross spread nets roughly 1-2% after Kalshi fees. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.html
tags: ["event_market_pnl", "wave-36", "mcp:find_prediction_arbitrage"]
timestamp: 2026-07-14
---

# Prediction Market Arbitrage

> Exports a decision via MCP `find_prediction_arbitrage` — mandate type `event_market_pnl`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Prediction Market Analyzer](./art-211-prediction-market-analyzer.md)

**Feeds:** _terminal node_
