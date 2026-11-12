---
type: DecisionTool
title: "Servicing Compliance Clock"
description: "Computes servicer-compliance due dates and clock states from event dates and loan values: error-resolution and information-request clocks, loss-mitigation acknowledgment and evaluation, the 37-day pre-sale boundary, the 120-day pre-foreclosure bar, no-duplicate processing, force-placed-insurance notice, reminder, cancel and refund clocks, payment-crediting and payoff-statement deadlines, and ARM notice windows with their exception branches. Every obligation carries its paragraph citation and a named business-day calendar assumption. Invalid dates, removed rule branches and over-bound event sets are refused, never computed."
resource: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.html
tags: ["consumer_finance", "wave-131", "mcp:servicing_compliance_clock"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/733-servicing-compliance-clock.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.html
    title: "public tool page"
---

# Servicing Compliance Clock

> Exports a decision via MCP `servicing_compliance_clock` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/733-servicing-compliance-clock.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/733-servicing-compliance-clock.md) — §10.2.
