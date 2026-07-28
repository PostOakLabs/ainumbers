---
type: DecisionTool
title: "Internal Rate of Return (IRR)"
description: "Internal rate of return for an equal-period cash flow series, solved by deterministic bisection over a declared rate bracket with declared tolerance and iteration cap. Never Newton/derivative-based, so no float-drift nondeterminism. Reports whether the bracket contained a sign change and whether the search converged."
resource: https://ainumbers.co/chaingraph/art-325-tvm-irr.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_irr"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-325-tvm-irr.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-325-tvm-irr.html
    title: "public tool page"
---

# Internal Rate of Return (IRR)

> Exports a decision via MCP `compute_irr` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-325-tvm-irr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-325-tvm-irr.md) — §10.2.
