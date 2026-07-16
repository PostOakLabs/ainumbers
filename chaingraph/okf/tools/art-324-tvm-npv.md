---
type: DecisionTool
title: "Net Present Value (NPV)"
description: "Net present value of a cash flow series, discounted at a declared periodic rate. Accepts either caller-supplied period offsets or dated cash flows converted to years under a declared day-count convention (30/360, ACT/360, ACT/365, or a simplified ACT/ACT). Deterministic pow via Taylor-series exp/ln, no engine transcendentals. Foundation primitive for downstream valuation and lease/loan analytics."
resource: https://ainumbers.co/chaingraph/art-324-tvm-npv.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_npv"]
timestamp: 2026-07-14
---

# Net Present Value (NPV)

> Exports a decision via MCP `compute_npv` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-324-tvm-npv.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
