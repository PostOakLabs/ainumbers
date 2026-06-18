---
type: DecisionTool
title: "ACP Checkout Conformance Validator"
description: "OpenAI/Stripe Agentic Commerce Protocol (ACP): CheckoutRequest/Response field conformance (10 required fields each), Shared Payment Token structure, ISO 4217 currency, TTL, signature prefix validation. Suite now covers both AP2 (Google) and ACP (OpenAI/Stripe)."
resource: https://ainumbers.co/chaingraph/art-12-acp-checkout-conformance-validator.html
tags: ["payment_mandate", "wave-2", "mcp:validate_acp_checkout"]
timestamp: 2026-06-18T13:58:30.949Z
---

# ACP Checkout Conformance Validator

> Exports a decision via MCP `validate_acp_checkout` — mandate type `payment_mandate`.

**Context:** ACP live — Etsy, Shopify (~1M merchants), Walmart (2026)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-12-acp-checkout-conformance-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
