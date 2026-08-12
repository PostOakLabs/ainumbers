---
type: DecisionTool
title: "ERC-7540 Async-Vault Request Accounting"
description: "Recomputes ERC-7540 asynchronous-vault request accounting from caller-declared request state. ERC-7540 (Final, Created 2023-10-18, CC0-1.0) extends ERC-4626 with a three-state request lifecycle used by institutional and real-world-asset funds that cannot settle a deposit or redemption in the same transaction: an amount is Pending after a request, becomes Claimable when the vault fulfils it, and is Claimed when the holder finally calls deposit, mint, withdraw or redeem. This node applies a sequence of claims against the claimable buckets at the pro-rata rate they were made claimable at, tracks the pending, claimable and claimed split for both legs, reports the rounding residue a sequence of partial claims strands, and checks the standard's own invariants by name: pending and claimable are disjoint views, a claim never short-circuits the Claim state, a claim never exceeds what is claimable, and a request with a non-zero requestId stays at a single pro-rata rate. ERC-7540 mandates no rounding direction for a partial claim, unlike ERC-4626 which fixes one per function, so the direction here is a declared parameter and the result of the opposite direction is reported beside it rather than a direction being presented as required. All arithmetic is exact uint256 integer math with no floating point. This node never reads any chain: it cannot know whether the declared amounts match a deployed vault, when or whether a pending request will be fulfilled, whether the controller is authorised, or whether a claim transaction would succeed."
resource: https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.html
tags: ["payment_policy", "wave-99", "mcp:recompute_erc7540_request_accounting"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-611-erc7540-async-vault-request-accounting.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.html
    title: "public tool page"
---

# ERC-7540 Async-Vault Request Accounting

> Exports a decision via MCP `recompute_erc7540_request_accounting` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-611-erc7540-async-vault-request-accounting.md) — §10.2.
