---
type: DecisionTool
title: "Bond Convexity"
description: "Standard closed-form convexity for a bullet bond, annualized by compounding frequency squared. Second-order complement to modified duration for estimating bond price sensitivity to larger yield moves; optionally reports the convexity price-adjustment term for a declared yield shock. Same bond schedule builder as compute_bond_duration."
resource: https://ainumbers.co/chaingraph/art-331-tvm-convexity.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_convexity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-331-tvm-convexity.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-331-tvm-convexity.html
    title: "public tool page"
---

# Bond Convexity

> Exports a decision via MCP `compute_convexity` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-331-tvm-convexity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Bond Macaulay / Modified Duration](./art-329-tvm-bond-duration.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-331-tvm-convexity.md) — §10.2.
