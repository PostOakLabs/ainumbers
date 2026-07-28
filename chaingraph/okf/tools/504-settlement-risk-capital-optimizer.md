---
type: DecisionTool
title: "Settlement-Risk Capital Efficiency Optimizer"
description: "Quantify RWA and capital savings from moving to Canton atomic DvP. Outputs bps-of-notional saved per year under BCBS CRE70/CRE52 SA-CCR. Stage 2 of the Canton Capital Efficiency chain."
resource: https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.html
tags: ["capital_assessment", "wave-8", "mcp:optimize_settlement_capital", "iso20022:pacs.008-subset"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/504-settlement-risk-capital-optimizer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.html
    title: "public tool page"
---

# Settlement-Risk Capital Efficiency Optimizer

> Exports a decision via MCP `optimize_settlement_capital` — mandate type `capital_assessment`.

**Context:** Canton capital efficiency chain. CRE70 settlement-risk capital relief; CRE52 SA-CCR netting.

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Canton Tokenization Readiness Diagnostic](./503-canton-tokenization-readiness-diagnostic.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/504-settlement-risk-capital-optimizer.md) — §10.2.
