---
type: DecisionTool
title: "Agent Payment Mandate Cross-Protocol Mapper"
description: "Translates an agentic-payment mandate declared under one protocol (AP2, x402, or ACP) into the field vocabulary of another, pivoting through one internal canonical schema so each protocol needs only one mapping in and one mapping out. Emits the translated mandate plus a mapping receipt: source digest, target digest, mapping-table version, and a declared lossy-fields list, so any field the source could not carry is surfaced rather than silently dropped. AP2 and x402 field usage verified against art-01, art-62, and art-26; ACP is a draft-generic profile pending independent confirmation of its public schema. Verify-only and translate-only: nothing here initiates, routes, or settles a payment."
resource: https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.html
tags: ["compliance_control", "wave-71", "mcp:map_agent_payment_mandate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-476-map-agent-payment-mandate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.html
    title: "public tool page"
---

# Agent Payment Mandate Cross-Protocol Mapper

> Exports a decision via MCP `map_agent_payment_mandate` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-476-map-agent-payment-mandate.md) — §10.2.
