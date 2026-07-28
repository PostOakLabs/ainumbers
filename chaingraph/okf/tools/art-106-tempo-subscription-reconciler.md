---
type: DecisionTool
title: "Tempo Subscription & Streaming Settlement Reconciler"
description: "Reconcile executed MPP recurring/streamed draws against the authorized mandate envelope, prove draw-set integrity via Merkle root, and detect per-cycle cap breaches, cumulative-cap violations, and mandate-expiry/revocation breaches. Distinct from tempo-mpp-agent (pre-execution authorization): this audits the post-execution draw lifecycle."
resource: https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.html
tags: ["settlement_mandate", "wave-21", "mcp:reconcile_mpp_subscription"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-106-tempo-subscription-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.html
    title: "public tool page"
---

# Tempo Subscription & Streaming Settlement Reconciler

> Exports a decision via MCP `reconcile_mpp_subscription` — mandate type `settlement_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo MPP Agent Mandate](./art-36-tempo-mpp-agent-mandate.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-106-tempo-subscription-reconciler.md) — §10.2.
