---
type: DecisionTool
title: "Tempo MPP Agent Mandate"
description: "Parses an MPP (Machine Payments Protocol) session, validates spend cap and session terms, maps HTTP-402 flow to AP2 Intent→Cart→Payment, performs KYA agent identity check (did:key format), models settlement cost, and emits a signed agent-payment mandate. W-C co-lead. ISO 20022 pacs.008-subset artifact; did:key identity in debtor field."
resource: https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.html
tags: ["payment_mandate", "wave-9", "mcp:decode_mpp_session"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-36-tempo-mpp-agent-mandate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.html
    title: "public tool page"
---

# Tempo MPP Agent Mandate

> Exports a decision via MCP `decode_mpp_session` — mandate type `payment_mandate`.

**Context:** MPP open standard live March 2026. W-C Tempo agent-payments co-lead.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Tempo Fit Diagnostic](./art-34-tempo-fit-diagnostic.md)

**Feeds:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md), [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md)
