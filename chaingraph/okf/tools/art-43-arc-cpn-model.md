---
type: DecisionTool
title: "Arc CPN Corridor Economics Model"
description: "Model CPN corridor economics vs SWIFT/ACH/SEPA/card/RTP for cross-border USD flows. Quantifies per-payment cost, FX spread, settlement time, and 3-year NPV. Industry benchmarks: WorldBank Q4 2024 (SWIFT 5.5% remittance), Nacha 2024 (ACH). CPN fee $0.01 user-adjustable estimate."
resource: https://ainumbers.co/chaingraph/art-43-arc-cpn-model.html
tags: ["treasury_mandate", "wave-10", "mcp:model_arc_cpn_economics", "iso20022:pacs.008"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-43-arc-cpn-model.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-43-arc-cpn-model.html
    title: "public tool page"
---

# Arc CPN Corridor Economics Model

> Exports a decision via MCP `model_arc_cpn_economics` — mandate type `treasury_mandate`.

**Context:** Arc mainnet 2026. CPN is Circle's global payment rail on Arc for USDC settlement.

**Semantic profile:** `iso20022:pacs.008` (ISO 20022-aligned)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-43-arc-cpn-model.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-43-arc-cpn-model.md) — §10.2.
