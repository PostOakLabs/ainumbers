---
type: DecisionTool
title: "Pendle Yield Tokenization Analyzer (PT/YT)"
description: "Decomposes Pendle Finance yield tokenization: PT implied fixed yield, YT leverage and break-even APY, PT+YT=1 invariant check, and time-to-maturity analytics. Covers Pendle/Ethena sUSDe presets. Determines whether YT is profitable at current underlying APY and by how much. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-273-pendle-yield.html
tags: ["analytics_mandate", "wave-46", "mcp:compute_pt_yt_yield"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-273-pendle-yield.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-273-pendle-yield.html
    title: "public tool page"
---

# Pendle Yield Tokenization Analyzer (PT/YT)

> Exports a decision via MCP `compute_pt_yt_yield` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-273-pendle-yield.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-273-pendle-yield.md) — §10.2.
