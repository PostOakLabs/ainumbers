---
type: DecisionTool
title: "Arc Paymaster Economics Model"
description: "ERC-4337 Paymaster economics model for Arc. Computes gas cost (gasPerUop × gasPriceGwei × 1e-9 × ethPriceUsd), sponsorship break-even, and per-UOp user-facing cost. Comparison: Arc user pays / Arc+Paymaster / Ethereum L1. No ETH bootstrap required on Arc (USDC-as-gas)."
resource: https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.html
tags: ["treasury_mandate", "wave-10", "mcp:model_arc_paymaster_economics", "iso20022:pacs.028"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-46-arc-paymaster-model.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.html
    title: "public tool page"
---

# Arc Paymaster Economics Model

> Exports a decision via MCP `model_arc_paymaster_economics` — mandate type `treasury_mandate`.

**Context:** Arc mainnet 2026. ERC-4337 account abstraction live on Arc testnet Oct 2025.

**Semantic profile:** `iso20022:pacs.028` (ISO 20022-aligned)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** _terminal node_
