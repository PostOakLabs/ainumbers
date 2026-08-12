---
type: DecisionTool
title: "ERC-4626 Vault Share Math"
description: "Recomputes ERC-4626 tokenized-vault share and asset conversions from caller-declared vault state (total_assets, total_supply, optional virtual-amounts offset), applying the rounding direction the standard mandates for each function and reporting which direction produced each result alongside what the opposite direction would have produced. ERC-4626 (Final, Created 2021-12-22, CC0-1.0) fixes those directions per function: convertToShares and convertToAssets round down towards 0, previewDeposit returns no more than the shares a deposit would mint and previewRedeem no more than the assets a redeem would withdraw (both round down), while previewMint returns no fewer than the assets a mint would deposit and previewWithdraw no fewer than the shares a withdraw would burn (both round up). Getting one direction backwards is how a vault leaks value, so each is checked separately. Also computes a deposit-then-redeem round-trip loss bound against the post-deposit state, a signed exchange-rate drift between two declared snapshots, and a declared fee application. All arithmetic is exact uint256 integer math with no floating point. This node never reads any chain: it cannot know whether the declared totals match a deployed vault, whether that vault applies these directions, or whether a rate change came from yield, loss, a donation, or an attack."
resource: https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html
tags: ["payment_policy", "wave-99", "mcp:recompute_erc4626_vault_share_math"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-610-erc4626-vault-share-math.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html
    title: "public tool page"
---

# ERC-4626 Vault Share Math

> Exports a decision via MCP `recompute_erc4626_vault_share_math` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-610-erc4626-vault-share-math.md) — §10.2.
