---
type: DecisionTool
title: "Google AP2 Mandate Builder"
description: "Builds an illustrative Google AP2 Checkout/Payment Mandate Verifiable Digital Credential (VDC) skeleton from a declared mandate type, stage, agent, subject, merchant, and amount. Stage 2 of the Agentic Policy Chain. This is the EXTERNAL Google AP2 payments protocol shape (ap2-protocol.org), distinct from the AINumbers Policy Mandate export. Field names are illustrative; sign with the agent key and verify against the live spec before real use. Zero PII, deterministic compute."
resource: https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.html
tags: ["payment_policy", "wave-ORPHANNODE-ONBOARD-2", "mcp:draft_ap2_mandate_credential"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-16-google-ap2-mandate-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.html
    title: "public tool page"
---

# Google AP2 Mandate Builder

> Exports a decision via MCP `draft_ap2_mandate_credential` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Mandate Sandbox](./art-15-agentic-mandate-sandbox.md), [Agentic Payments Protocol Comparator](./art-22-agentic-payments-protocol-comparator.md), [Agentic Payments Readiness Diagnostic](./art-27-agentic-readiness-diagnostic.md)

**Feeds:** [AP2/MCP Policy Validator](./art-17-ap2-mcp-policy-validator.md), [Visa Trusted Agent Protocol (TAP) Signature Inspector](./art-23-visa-trusted-agent-protocol-inspector.md)

## Attested computation

[executor + attester binding](../computations/art-16-google-ap2-mandate-builder.md) — §10.2.
