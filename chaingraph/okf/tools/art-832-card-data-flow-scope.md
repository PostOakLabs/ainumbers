---
type: DecisionTool
title: "Card Data Flow Worksheet"
description: "A worksheet over declared inputs rather than a scope determination. You list system nodes (front end, back end, logs, analytics, a browser-automation provider, a payment service provider) with flags for what each handles: sees the raw card number, sees a token only, stores, logs, records sessions, has unrestricted connectivity to a card-number-handling component, could affect the security of one. The node sorts the declared nodes into four sets that mirror the wording of the PCI DSS v4.0.1 scope section (stores, processes or transmits card data; unrestricted connectivity to such a component; could impact its security; not placed by the declared inputs) and lists capture leaks: logs, session recordings and analytics captures that, by the declared inputs, record or log a system that sees the card number. It does not evaluate segmentation adequacy, does not read any network, and says nothing about whether any entity meets any requirement. Scope decisions stay with the entity and its assessor."
resource: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.html
tags: ["compliance_control", "wave-144", "mcp:map_card_data_flow_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-832-card-data-flow-scope.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.html
    title: "public tool page"
---

# Card Data Flow Worksheet

> Exports a decision via MCP `map_card_data_flow_scope` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-832-card-data-flow-scope.md) — §10.2.
