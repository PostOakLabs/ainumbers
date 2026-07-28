---
type: DecisionTool
title: "ERC-8056 Multiplier Reconciler"
description: "Reconciles Robinhood Chain stock-token corporate actions against the ERC-8056 scaled UI amount surface. Stock tokens never rebase; splits and dividends land as a uiMultiplier() change plus a UIMultiplierUpdated event while raw balanceOf stays static until redemption. Checks declared corporate-action ratio against the multiplier transition, monotonic event sequencing, and raw-balance invariance. First tooling anywhere for ERC-8056 reconciliation. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html
tags: ["collateral_mandate", "wave-56", "mcp:reconcile_erc8056_multiplier"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-317-rhc-multiplier-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html
    title: "public tool page"
---

# ERC-8056 Multiplier Reconciler

> Exports a decision via MCP `reconcile_erc8056_multiplier` — mandate type `collateral_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-317-rhc-multiplier-reconciler.md) — §10.2.
