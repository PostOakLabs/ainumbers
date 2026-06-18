---
type: DecisionTool
title: "x402 Settlement Cost & Finality Modeler"
description: "Rail-selection and finality recommendation across x402 (HTTP 402), Stripe USDC, card, ACH, and SWIFT. Per-transaction cost, eligibility scoring, micropayment support, cross-border flags. ~69k active agents / 165M+ x402 txns (2026)."
resource: https://ainumbers.co/chaingraph/art-03-x402-settlement-modeler.html
tags: ["settlement_mandate", "wave-2", "mcp:model_x402_settlement", "iso20022:pacs.008-subset"]
timestamp: 2026-06-18T15:15:44.978Z
---

# x402 Settlement Cost & Finality Modeler

> Exports a decision via MCP `model_x402_settlement` — mandate type `settlement_mandate`.

**Context:** x402 live on Coinbase CDP; Stripe USDC on Base

**Semantic profile:** `iso20022:pacs.008-subset` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-03-x402-settlement-modeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
