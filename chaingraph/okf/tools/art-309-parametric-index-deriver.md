---
type: DecisionTool
title: "Parametric Index Deriver"
description: "Deterministically aggregates a named metric (mean, sum, count, max, or min) across a receipt set into a parametric index value: receipts as an oracle replacement, replay-on-challenge instead of trust-the-feed. Feeds the shipped compute_parametric_trigger_payout kernel, which performs the actual trigger-vs-payout math; this kernel never reimplements that logic. The index is a replayable derived value, never a settlement trigger by itself. Not the same as check_agency_eligibility_matrix or any lending eligibility tool -- this is an insurance-evidence parametric index. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.html
tags: ["compliance_mandate", "wave-54", "mcp:derive_parametric_index_from_receipts"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-309-parametric-index-deriver.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.html
    title: "public tool page"
---

# Parametric Index Deriver

> Exports a decision via MCP `derive_parametric_index_from_receipts` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Parametric Trigger Payout Calculator](./art-251-compute-parametric-trigger-payout.md)

## Attested computation

[executor + attester binding](../computations/art-309-parametric-index-deriver.md) — §10.2.
