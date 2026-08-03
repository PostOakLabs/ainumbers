---
type: DecisionTool
title: "MCP Developer Readiness Scorecard"
description: "Rolls up caller-supplied yes/partial/no answers across six MCP ship-readiness sections (tool definitions, server.json/registry, OAuth 2.1, transport security, tool-poisoning hygiene, spec-revision compliance) into an overall 0-100 score and a prioritized gap list. Stage 4 (terminal) of the Agentic Policy Chain. Self-reported rollup; validate each weak section with its own deep-dive tool. Deterministic, zero PII."
resource: https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html
tags: ["compliance_control", "wave-A", "mcp:score_mcp_server_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-18-mcp-developer-readiness-scorecard.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html
    title: "public tool page"
---

# MCP Developer Readiness Scorecard

> Exports a decision via MCP `score_mcp_server_readiness` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2/MCP Policy Validator](./art-17-ap2-mcp-policy-validator.md), [Visa Trusted Agent Protocol (TAP) Signature Inspector](./art-23-visa-trusted-agent-protocol-inspector.md), [Mastercard Agentic Token Scope Builder](./art-24-mastercard-agentic-token-builder.md), [A2A Agent Card Validator & Extension Checker](./art-25-a2a-agent-card-validator.md), [x402 Header Decoder, Payload Linter & 402 Flow Simulator](./art-26-x402-payload-decoder-flow-simulator.md), [Agentic Payments Readiness Diagnostic](./art-27-agentic-readiness-diagnostic.md), [MCP Server Deployability Diagnostic](./art-28-mcp-server-deployability-diagnostic.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-18-mcp-developer-readiness-scorecard.md) — §10.2.
