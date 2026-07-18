---
type: DecisionTool
title: "Canton Synchronizer Traffic-Cost Calculator"
description: "Computes Canton Network synchronizer traffic cost (CIP-0042/CIP-0084 regime): fee = message megabytes x the Tokenomics-Committee-set USD/MB rate, converted to Canton Coin burned at a caller-supplied CC/USD price. Applies the CIP-0119 transfer-preapproval free-traffic window (90-day base duration since June 2026) when applicable. Rate, price, and protocol-version inputs are caller-supplied and source-cited in the output."
resource: https://ainumbers.co/chaingraph/art-391-compute-canton-traffic-cost.html
tags: ["analytics_mandate", "wave-64", "mcp:compute_canton_traffic_cost"]
timestamp: 2026-07-18
---

# Canton Synchronizer Traffic-Cost Calculator

> Exports a decision via MCP `compute_canton_traffic_cost` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-391-compute-canton-traffic-cost.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
