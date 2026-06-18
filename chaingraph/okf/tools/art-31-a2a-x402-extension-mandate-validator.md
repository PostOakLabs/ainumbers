---
type: DecisionTool
title: "A2A x402-Extension Mandate Validator"
description: "Validates the A2A x402 extension (Coinbase/MetaMask/Ethereum Foundation) that carries crypto-payment authority inside an AP2 mandate: extension declaration in the A2A agent card, payment-authority scope, settlement-rail binding, exact-scheme x402 PaymentPayload lint, and mandate-to-payment-leg consistency. PASS/WARN/FAIL verdict + execution_hash. Educational/simulation."
resource: https://ainumbers.co/chaingraph/art-31-a2a-x402-extension-mandate-validator.html
tags: ["settlement_mandate", "wave-6", "mcp:validate_a2a_x402_mandate"]
timestamp: 2026-06-18T14:43:45.819Z
---

# A2A x402-Extension Mandate Validator

> Exports a decision via MCP `validate_a2a_x402_mandate` — mandate type `settlement_mandate`.

**Context:** Wave 6 — tracks the production A2A x402 extension (2026).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-31-a2a-x402-extension-mandate-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [x402 Settlement Cost & Finality Modeler](./art-03-x402-settlement-modeler.md)

**Feeds:** [Agent Commerce Cross-Protocol Conformance Validator](./art-30-agent-commerce-conformance-validator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
