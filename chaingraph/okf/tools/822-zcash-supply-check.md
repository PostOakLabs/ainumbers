---
type: DecisionTool
title: "Zcash Supply Check"
description: "Checks the arithmetic of user-pasted Zcash chain value pool balances (transparent, Sprout, Sapling, Orchard, in integer zatoshi) against a claimed total supply: recomputes the pool sum exactly, checks every pool is non-negative (the pinned negative-balance consensus rules declare a negative pool an invalid chain state), and tests the no-counterfeiting conservation identity that the four pools together equal the claimed supply, reporting any difference exactly with its sign. It states plainly that it cannot read the chain and does not verify that the pasted numbers are true: evidence.chain_verified is false on every payload, including a conserved one. Refusal branches cover non-numeric values (never echoed), pool names outside the four pinned pools (lockbox included), a missing pool, an absent claimed supply, fractional zatoshi, and values above the declared safe-arithmetic bound. Declared exclusions: values only, no chain access, no lockbox or deferred pool, no height or issuance-history corroboration, no market or price figures, not investment advice."
resource: https://ainumbers.co/chaingraph/822-zcash-supply-check.html
tags: ["cryptographic_mandate", "wave-142", "mcp:audit_zcash_pool_supply"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/822-zcash-supply-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/822-zcash-supply-check.html
    title: "public tool page"
---

# Zcash Supply Check

> Exports a decision via MCP `audit_zcash_pool_supply` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/822-zcash-supply-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/822-zcash-supply-check.md) — §10.2.
