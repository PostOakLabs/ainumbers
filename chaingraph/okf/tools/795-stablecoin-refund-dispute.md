---
type: DecisionTool
title: "Stablecoin Refund Dispute Check"
description: "Recomputes the expected refund and dispute outcome of stablecoin payments held under an escrowed refund protocol (lock period, refund request, arbiter decision, early-withdrawal fee, partial refunds) from aggregate, synthetic-label payment records only, and flags each break between the merchant reported state or amounts and the recomputation with a named rule: payments held for the caller-declared lock period are released in full after the lock, an arbiter refund is all-or-nothing unless the caller declares partial refunds allowed, an early withdrawal inside the lock carries a fee recomputed as floor(amount times fee_bp over 10000) in integer minor units (round-down, the node single documented rounding rule), and paid equals refunded plus released plus fee plus still held per payment and in total with a CONSISTENT, CONSISTENT_WITH_BREAKS or INCONSISTENT verdict. Aggregate-only: payment_ref values are opaque synthetic labels; any label resembling an address, transaction hash or long identifier-like blob is refused with no echo, and no payer or merchant data is accepted. Rules for the pinned profile re-implement the Circle Refund Protocol (Apache-2.0) escrow, refund, arbiter and early-withdrawal behaviour from a pinned source snapshot cited in cited_clause_digest; the generic profile takes every rule caller-declared. Payment settlement evidence lives in the x402 and CCTP nodes; this node consumes none of their outputs. Declared domain exclusions: no fiat chargeback networks, no FX or token-price effects, no legal-outcome prediction, values only, synthetic data only."
resource: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.html
tags: ["compliance_control", "wave-141", "mcp:check_stablecoin_refunds"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/795-stablecoin-refund-dispute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.html
    title: "public tool page"
---

# Stablecoin Refund Dispute Check

> Exports a decision via MCP `check_stablecoin_refunds` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/795-stablecoin-refund-dispute.md) — §10.2.
