---
type: DecisionTool
title: "Token-2022 Withheld-Fee Reconciler"
description: "Token-2022 withheld-fee reconciliation across token accounts (SOLANA-WITHHELD-FEE-RECON-1, first add after art-715; primary text re-pinned at claim: solana-program/token-2022 commit b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e)"
resource: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html
tags: ["settlement_mandate", "wave-137", "mcp:reconcile_token2022_withheld"]
timestamp: 2026-10-27
generated: { by: "ainumbers/generate-okf", at: "2026-10-27" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-778-token2022-withheld-fee-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html
    title: "public tool page"
---

# Token-2022 Withheld-Fee Reconciler

> Exports a decision via MCP `reconcile_token2022_withheld`, mandate type `settlement_mandate`.

**Context:** Withheld transfer fees sit per token account (`TransferFeeAmount.withheld_amount`) while harvested fees accumulate on the mint (`TransferFeeConfig.withheld_amount`), pinned at solana-program/token-2022 commit b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e. The node recomputes the per-account sum over mint-matching accounts (the harvest skips a wrong-mint account with MintMismatch), reconciles it against the declared total, projects the post-harvest mint pot under checked_add semantics (Overflow past u64 reported, never wrapped), flags duplicates, and checks fee-receiver placement (destination mint, withdraw authority). Facts only.

## Inputs

Typed `inputSchema`; see [tool page](https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-778-token2022-withheld-fee-reconciler.md) (§10.2).
