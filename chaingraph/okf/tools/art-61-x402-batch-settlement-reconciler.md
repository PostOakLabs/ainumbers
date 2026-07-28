---
type: DecisionTool
title: "x402 V2 Batch-Settlement Reconciler"
description: "Reconciles an x402 V2 batch settlement (off-chain payment vouchers vs onchain batch total), verifying recon verdict, per-voucher amounts, settlement-risk window (unredeemed voucher exposure), and computing an educational Merkle root over the voucher set. Runtime/post-trade: art-03 models V1 pre-trade; ART-61 reconciles an actual V2 batch post-settlement."
resource: https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.html
tags: ["settlement_mandate", "wave-14", "mcp:reconcile_x402_batch_settlement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-61-x402-batch-settlement-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.html
    title: "public tool page"
---

# x402 V2 Batch-Settlement Reconciler

> Exports a decision via MCP `reconcile_x402_batch_settlement` — mandate type `settlement_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Economy Runtime Fit Diagnostic](./art-60-agent-economy-runtime-fit-diagnostic.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-61-x402-batch-settlement-reconciler.md) — §10.2.
