---
type: DecisionTool
title: "Token-2022 Transfer-Fee Payment Reconciler"
description: "Recomputes the transfer fee a Token-2022 mint with the transfer-fee extension withholds and the net amount the recipient receives, given the fee schedule, the TransferChecked amount, the execution epoch and the amount a payment verifier credited, then reconciles the credited amount against that net: MATCH, OVER_CREDITED or UNDER_CREDITED with credited_minus_net reported. OVER_CREDITED with the fee as the difference reproduces the Kora GHSA-725g defect class, a facilitator crediting the pre-fee gross amount; the advisory's arithmetic is quoted only as its public text states it. All amounts are decimal strings computed in BigInt with 128-bit intermediates and no floats, porting the pinned Token-2022 clause arithmetic: ceiling(amount times basis points over 10,000) capped at maximum_fee, the newer schedule applying from its epoch on, and the informational minimal pre-fee inverse choosing the smaller amount. The output also records a declared-fee FeeMismatch for TransferCheckedWithFee, an EPOCH_SCHEDULE_DIVERGENCE when the verifier used a different schedule than the execution epoch, and an informational consumer view showing where the x402 SVM gross-amount exact-match path and the balance-delta net path disagree. Exclusions: no wallet addresses, no authorities, no account keys, no signatures, no live data."
resource: https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.html
tags: ["settlement_mandate", "wave-125", "mcp:reconcile_token2022_transfer_fee"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-715-token2022-transfer-fee-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.html
    title: "public tool page"
---

# Token-2022 Transfer-Fee Payment Reconciler

> Exports a decision via MCP `reconcile_token2022_transfer_fee` — mandate type `settlement_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-715-token2022-transfer-fee-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-715-token2022-transfer-fee-reconciler.md) — §10.2.
