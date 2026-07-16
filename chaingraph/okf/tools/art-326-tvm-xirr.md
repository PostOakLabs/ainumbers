---
type: DecisionTool
title: "XIRR (Irregular Dated Cash Flows)"
description: "Annualized rate of return for irregular-interval dated cash flows, matching Excel XIRR semantics exactly: fixed actual/365 day count, anchored to the first cash flow date, solved by deterministic bisection over a declared rate bracket. Companion to compute_irr for cash flows that do not fall on equal periods."
resource: https://ainumbers.co/chaingraph/art-326-tvm-xirr.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_xirr"]
timestamp: 2026-07-14
---

# XIRR (Irregular Dated Cash Flows)

> Exports a decision via MCP `compute_xirr` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-326-tvm-xirr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
