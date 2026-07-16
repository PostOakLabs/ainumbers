---
type: DecisionTool
title: "Bond Macaulay / Modified Duration"
description: "Macaulay and modified duration for a standard even-period bullet bond, given face value, coupon rate, yield to maturity, years to maturity, and compounding frequency. Prices the schedule and reports the PV-weighted average time to cash flows in years. Feeds compute_dv01 and compute_convexity for full fixed-income risk analytics."
resource: https://ainumbers.co/chaingraph/art-329-tvm-bond-duration.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_bond_duration"]
timestamp: 2026-07-14
---

# Bond Macaulay / Modified Duration

> Exports a decision via MCP `compute_bond_duration` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-329-tvm-bond-duration.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Bond DV01 (Price Value of a Basis Point)](./art-330-tvm-dv01.md), [Bond Convexity](./art-331-tvm-convexity.md)
