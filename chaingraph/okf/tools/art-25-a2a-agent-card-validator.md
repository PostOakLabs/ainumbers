---
type: DecisionTool
title: "A2A Agent Card Validator & Extension Checker"
description: "Validates an A2A agent-card.json against the v1.0 shape: identity fields, capabilities, extensions (AP2/x402), input/output modes, skills, provider, signed-card JWS block. Branch B, node 1 of the Agentic Rail Chain. Promoted from T283."
resource: https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.html
tags: ["compliance_control", "wave-A", "mcp:verify_a2a_agent_card"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-25-a2a-agent-card-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.html
    title: "public tool page"
---

# A2A Agent Card Validator & Extension Checker

> Exports a decision via MCP `verify_a2a_agent_card` — mandate type `compliance_control`.

**Context:** A2A v1.0 live (Linux Foundation, 2026)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Payments Protocol Comparator](./art-22-agentic-payments-protocol-comparator.md)

**Feeds:** [MCP Developer Readiness Scorecard](./art-18-mcp-developer-readiness-scorecard.md), [x402 Header Decoder, Payload Linter & 402 Flow Simulator](./art-26-x402-payload-decoder-flow-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-25-a2a-agent-card-validator.md) — §10.2.
