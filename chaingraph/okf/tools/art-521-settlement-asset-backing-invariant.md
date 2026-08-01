---
type: DecisionTool
title: "Settlement-Asset Backing Invariant"
description: "Checks whether value held across an issuance topology stays fully backed in aggregate, not merely per account, as balances move between caller-declared buffers. The caller names each buffer (its role, asset type, and what it backs), declares a backing-ratio requirement, per-buffer floor and ceiling, and a movement set. Evaluates the aggregate backing verdict before and after the declared movements, per-buffer floor/ceiling breaches, the thinnest safe margin per buffer, declared idle-balance cost versus declared crossing cost, and the specific movement that first breaks the invariant. Settlement-asset agnostic: the same kernel runs unchanged for centrally-issued digital cash, pooled-account-backed digital cash, and a reserve-backed stablecoin, demonstrated on fixtures with zero kernel difference. Does not sweep, net, or attest reserves, and issues no recommendation to move money."
resource: https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.html
tags: ["compliance_mandate", "wave-80", "mcp:verify_settlement_asset_backing"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-521-settlement-asset-backing-invariant.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.html
    title: "public tool page"
---

# Settlement-Asset Backing Invariant

> Exports a decision via MCP `verify_settlement_asset_backing` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-521-settlement-asset-backing-invariant.md) — §10.2.
