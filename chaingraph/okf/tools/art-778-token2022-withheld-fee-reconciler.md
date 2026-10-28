---
type: DecisionTool
title: "Token-2022 Withheld-Fee Reconciler"
description: "Token-2022 withheld-fee reconciliation across token accounts (the first node added after art-715; its primary text is the Solana Token-2022 program source, pinned at solana-program/token-2022 commit b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e). Inputs, all pasted values: the mint's declared TransferFeeConfig fields (its accumulated withheld_amount and its withdraw_withheld_authority, which may be null), a caller-declared list of token accounts each {address, mint, withheld_amount}, the caller's declared total, and optionally a declared harvest or withdraw destination {address, mint, withdraw_authority}. Outputs, values only: the per-account withheld sum recomputed over mint-matching accounts (the program's HarvestWithheldTokensToMint skips a wrong-mint account with MintMismatch instead of moving its fees), the mint's accumulated withheld_amount, what the mint would accumulate after harvesting every mint-matching account (the on-chain addition is checked_add, so past u64 the harvest fails with TokenError::Overflow, reported as a fact, never wrapped), the declared total versus the recomputed total with the signed difference, lists of wrong-mint accounts and duplicate addresses in the declared list, and a fee-receiver placement check: whether the declared destination's mint matches the declared mint and whether the declared withdraw authority is the config's withdraw_withheld_authority (withdraw instructions require that signer; harvest to the mint is permissionless). Amounts are u64 token minor units in decimal strings, summed in BigInt. Facts only: no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read."
resource: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html
tags: ["settlement_mandate", "wave-137", "mcp:reconcile_token2022_withheld"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-778-token2022-withheld-fee-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html
    title: "public tool page"
---

# Token-2022 Withheld-Fee Reconciler

> Exports a decision via MCP `reconcile_token2022_withheld` — mandate type `settlement_mandate`.

**Context:** No regulatory deadline: this node reconciles pasted Token-2022 withheld-fee values, it does not carry a dated obligation.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-778-token2022-withheld-fee-reconciler.md) — §10.2.
