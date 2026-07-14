---
type: DecisionTool
title: "Perp Funding and Carry Calculator"
description: "Computes perpetual futures funding rates, compound annual APR, and cross-venue funding differential arbitrage (Hyperliquid hourly vs Binance 8-hour cadence). Models delta-neutral carry strategies combining perp short funding with DeFi collateral yield (Ethena sUSDe). Includes basis analytics and Hyperliquid 4%/hr cap note. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-270-perp-funding-carry.html
tags: ["analytics_mandate", "wave-46", "mcp:compute_perp_funding"]
timestamp: 2026-07-14
---

# Perp Funding and Carry Calculator

> Exports a decision via MCP `compute_perp_funding` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-270-perp-funding-carry.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
