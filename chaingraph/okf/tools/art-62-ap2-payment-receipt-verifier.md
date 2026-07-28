---
type: DecisionTool
title: "AP2 PaymentReceipt Verifier & HNP Guardrail"
description: "Verifies an AP2 v0.2 PaymentReceipt against its signed Intent/Cart/Payment mandate chain, and applies the Human-Not-Present (HNP) autonomy guardrail: amount, category, mandate age, cart freshness. Runtime/post-trade: art-01 validates the mandate before the buy; ART-62 verifies the receipt after, applying HNP gating (AP2 v0.2 new primitive, FIDO Alliance Apr 2026)."
resource: https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.html
tags: ["attestation_mandate", "wave-14", "mcp:verify_ap2_payment_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-62-ap2-payment-receipt-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.html
    title: "public tool page"
---

# AP2 PaymentReceipt Verifier & HNP Guardrail

> Exports a decision via MCP `verify_ap2_payment_receipt` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Economy Runtime Fit Diagnostic](./art-60-agent-economy-runtime-fit-diagnostic.md)

**Feeds:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
