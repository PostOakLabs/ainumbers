---
type: DecisionTool
title: "ICM Quorum Forgery Classifier"
description: "Computes the smallest set of a source Avalanche L1's validators that could jointly sign an Interchain Messaging (ICM / Avalanche Warp Messaging) message the receiving L1 would accept: sorts the caller-transcribed stake weights descending, prefix-sums them, and returns the count at which the receiving chain's accepted stake-weight quorum is first satisfied, alongside that group's cumulative share, an HHI-style stake concentration figure, and a verdict against a caller-declared minimum-colluding floor. Quorum semantics follow avalanchego's Warp signature check (signed weight times 100 greater than or equal to total weight times the quorum percentage), evaluated cross-multiplied so no division rounding moves the boundary. The accepted quorum is a caller input with no baked-in default threshold, because it is the receiving chain's own acceptance policy for that source rather than a statutory number, following the precedent art-445 sets by refusing to bake in a concentration limit. Avalanche finality is sub-second with no reorg window, so the challenge-window arithmetic that applies to optimistic bridges does not transfer; this node picks up where that risk relocates, namely who signed the cross-chain message. Borrows only the art-445 helper pattern (fixed-point 2dp rounding, share-of-total, finite gate, NaN-safe coercion); art-445 computes top-N and per-sector rollups and does not compute a minimum-colluding set. Observes no chain: no RPC call and no P-Chain query, with the validator set transcribed by the caller as opaque identifiers. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.html
tags: ["analytics_mandate", "wave-78", "mcp:check_icm_quorum_forgery_risk"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-494-icm-quorum-forgery-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.html
    title: "public tool page"
---

# ICM Quorum Forgery Classifier

> Exports a decision via MCP `check_icm_quorum_forgery_risk` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-494-icm-quorum-forgery-classifier.md) — §10.2.
