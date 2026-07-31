---
type: DecisionTool
title: "x402 Header Decoder, Payload Linter & 402 Flow Simulator"
description: "Decodes base64 PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers, lints exact-scheme PaymentPayload (EIP-3009 style authorization fields), walks the HTTP-402 request/verify/settle flow, shows scheme×network matrix. Branch B, node 2 of the Agentic Rail Chain. Promoted from T277."
resource: https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.html
tags: ["compliance_control", "wave-A", "mcp:simulate_x402_flow"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-26-x402-payload-decoder-flow-simulator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.html
    title: "public tool page"
---

# x402 Header Decoder, Payload Linter & 402 Flow Simulator

> Exports a decision via MCP `simulate_x402_flow` — mandate type `compliance_control`.

**Context:** x402 live on Coinbase CDP; exact scheme live on base/polygon/arbitrum/solana

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Payments Protocol Comparator](./art-22-agentic-payments-protocol-comparator.md), [A2A Agent Card Validator & Extension Checker](./art-25-a2a-agent-card-validator.md)

**Feeds:** [x402 Settlement Cost & Finality Modeler](./art-03-x402-settlement-modeler.md), [MCP Developer Readiness Scorecard](./art-18-mcp-developer-readiness-scorecard.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-26-x402-payload-decoder-flow-simulator.md) — §10.2.
