---
type: DecisionTool
title: "Agentic Payments Protocol Comparator"
description: "Compares AP2, ACP, x402, Visa TAP, Mastercard Agentic Token, and Tempo MPP (Machine Payments Protocol) across 8 dimensions (backer, artifact, signing, scope, rail, identity, audit, status) and 6 agentic scenarios. Root node of the Agentic Rail Chain: routing_policy output determines Branch A (AP2/card) or Branch B (A2A/x402). Promoted from T276."
resource: https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.html
tags: ["routing_policy", "wave-A", "mcp:compare_agentic_rail_protocols"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-22-agentic-payments-protocol-comparator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.html
    title: "public tool page"
---

# Agentic Payments Protocol Comparator

> Exports a decision via MCP `compare_agentic_rail_protocols` — mandate type `routing_policy`.

**Context:** AP2 v0.2 live (FIDO Alliance, April 2026); Visa TAP launched; Mastercard Agent Pay announced Apr 2025

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Google AP2 Mandate Builder](./art-16-google-ap2-mandate-builder.md), [Visa Trusted Agent Protocol (TAP) Signature Inspector](./art-23-visa-trusted-agent-protocol-inspector.md), [Mastercard Agentic Token Scope Builder](./art-24-mastercard-agentic-token-builder.md), [A2A Agent Card Validator & Extension Checker](./art-25-a2a-agent-card-validator.md), [x402 Header Decoder, Payload Linter & 402 Flow Simulator](./art-26-x402-payload-decoder-flow-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-22-agentic-payments-protocol-comparator.md) — §10.2.
