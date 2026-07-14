---
type: DecisionTool
title: "Arc StableFX RFQ Economics Model"
description: "Quantify Herstatt risk elimination and FX spread savings from Arc StableFX 24/7 atomic PvP settlement vs non-CLS bilateral FX. Methodology: BIS (Allsopp et al. 1996) Herstatt credit cost proxy via counterparty spread. PFMI P12 atomic settlement; BIS FX Global Code P35 netting."
resource: https://ainumbers.co/chaingraph/art-44-arc-stablefx-model.html
tags: ["treasury_mandate", "wave-10", "mcp:model_arc_stablefx_rfq", "iso20022:fxtr.008"]
timestamp: 2026-07-14
---

# Arc StableFX RFQ Economics Model

> Exports a decision via MCP `model_arc_stablefx_rfq` — mandate type `treasury_mandate`.

**Context:** Arc StableFX live on Arc mainnet 2026. PFMI P12 compliance required for CCPs/CSDs.

**Semantic profile:** `iso20022:fxtr.008` (ISO 20022-aligned)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-44-arc-stablefx-model.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** _terminal node_
