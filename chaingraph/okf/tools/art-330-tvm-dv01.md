---
type: DecisionTool
title: "Bond DV01 (Price Value of a Basis Point)"
description: "DV01 / price value of a basis point for a standard even-period bullet bond, computed by full central-difference reprice at yield plus and minus a declared basis-point shock, not the linear modified-duration approximation. Stays accurate for large coupons or short maturities where the linear approximation drifts. Same bond schedule builder as compute_bond_duration."
resource: https://ainumbers.co/chaingraph/art-330-tvm-dv01.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_dv01"]
timestamp: 2026-07-14
---

# Bond DV01 (Price Value of a Basis Point)

> Exports a decision via MCP `compute_dv01` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-330-tvm-dv01.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Bond Macaulay / Modified Duration](./art-329-tvm-bond-duration.md)

**Feeds:** _terminal node_
