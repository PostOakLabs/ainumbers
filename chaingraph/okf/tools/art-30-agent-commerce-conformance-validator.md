---
type: DecisionTool
title: "Agent Commerce Cross-Protocol Conformance Validator"
description: "The synergy flagship of Wave 6. Validates a single agent purchase end-to-end across four protocols: AP2 v0.2 mandate chain (Intent → Cart → Payment), ACP checkout conformance (OpenAI/Stripe), Visa TAP RFC 9421 HTTP Message Signature inspection, and x402 settlement leg. Issues one unified PASS/WARN/FAIL verdict and a single execution_hash receipt (ChainGraph Standard v0.1 §4, chain_depth: 1). Consumes ART-01, ART-12, ART-03. Feeds CRY-05, PTG-01."
resource: https://ainumbers.co/chaingraph/art-30-agent-commerce-conformance-validator.html
tags: ["payment_mandate", "wave-6", "mcp:validate_agent_commerce_conformance"]
timestamp: 2026-06-18T15:15:44.978Z
---

# Agent Commerce Cross-Protocol Conformance Validator

> Exports a decision via MCP `validate_agent_commerce_conformance` — mandate type `payment_mandate`.

**Context:** Wave 6 — agent-commerce synergy flagship. Anchors cross-protocol compliance for AP2 + ACP + TAP + x402.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-30-agent-commerce-conformance-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md), [ACP Checkout Conformance Validator](./art-12-acp-checkout-conformance-validator.md), [x402 Settlement Cost & Finality Modeler](./art-03-x402-settlement-modeler.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
