---
type: DecisionTool
title: "Direct Indexing Fit Screen"
description: "Computes a direct-indexing fit screen from caller-declared synthetic inputs: the net benefit in basis points is the declared expected tax alpha minus the declared fee delta (direct-indexing fee minus ETF expense ratio), rounded half-up to 2 decimal places with the arithmetic restated in a trace. The verdict reports the sign of that declared arithmetic only (FIT_POSITIVE, FIT_NEGATIVE, FIT_NEUTRAL). When the caller also declares a holding period and an alpha-exhaustion horizon, the node adds an exhaustion warning; when the caller declares a concentrated stock position, it adds an unwind note. This is a deterministic calculator over declared numbers: it is never advice, never an optimizer, and it prices no costs it has not been given. Zero storage, zero network, no runtime clock."
resource: https://ainumbers.co/chaingraph/art-685-direct-indexing-fit-screen.html
tags: ["compliance_control", "wave-116", "mcp:compute_direct_indexing_fit_screen"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-685-direct-indexing-fit-screen.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-685-direct-indexing-fit-screen.html
    title: "public tool page"
---

# Direct Indexing Fit Screen

> Exports a decision via MCP `compute_direct_indexing_fit_screen` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-685-direct-indexing-fit-screen.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-685-direct-indexing-fit-screen.md) — §10.2.
