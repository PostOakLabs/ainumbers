---
type: DecisionTool
title: "Mastercard Agentic Token Scope Builder"
description: "Builds or lints a Mastercard Agent Pay Agentic Token scope: agent binding, merchant scope, consent policy (limits, expiry, velocity, MCC). The agent never receives the raw PAN (MDES tokenised). Branch A, node 3 of the Agentic Rail Chain. Promoted from T287."
resource: https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.html
tags: ["compliance_control", "wave-A", "mcp:build_mastercard_agentic_token"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-24-mastercard-agentic-token-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.html
    title: "public tool page"
---

# Mastercard Agentic Token Scope Builder

> Exports a decision via MCP `build_mastercard_agentic_token` — mandate type `compliance_control`.

**Context:** Mastercard Agent Pay announced Apr 2025; MDES Agentic Token schema partially public

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Payments Protocol Comparator](./art-22-agentic-payments-protocol-comparator.md), [Visa Trusted Agent Protocol (TAP) Signature Inspector](./art-23-visa-trusted-agent-protocol-inspector.md)

**Feeds:** `art-18-mcp-developer-readiness-scorecard` _(not live)_, [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
