---
type: DecisionTool
title: "AP2 Mandate-Chain Validator"
description: "Validates AP2 v0.2 Intent→Cart→Payment mandate trio: signature-chain integrity, scope/limit consistency, TTL/expiry, over-spend detection, Human-Not-Present autonomous-agent flows. Publishes conformance test-vector fixtures."
resource: https://ainumbers.co/chaingraph/art-01-ap2-mandate-chain-validator.html
tags: ["payment_mandate", "wave-1", "mcp:validate_ap2_mandate_chain"]
timestamp: 2026-06-18T15:15:44.978Z
---

# AP2 Mandate-Chain Validator

> Exports a decision via MCP `validate_ap2_mandate_chain` — mandate type `payment_mandate`.

**Context:** AP2 v0.2 live (FIDO Alliance, April 2026) — reference-implementation positioning

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-01-ap2-mandate-chain-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [x402 Settlement Cost & Finality Modeler](./art-03-x402-settlement-modeler.md), [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md), [ACP Checkout Conformance Validator](./art-12-acp-checkout-conformance-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
