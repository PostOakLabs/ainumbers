---
type: DecisionTool
title: "Corporate Action Entitlement Recompute"
description: "Deterministic dividend/rights/split entitlement math per record date for a single position, under the ISO 20022 corporate-action event field set migrated by DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission -- a DTCC operator mandate, not a regulatory deadline: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). entitlement = position_qty x ratio_or_rate, with rounding/proration rules per corporate-action type -- all caller-supplied, no security-master lookup, no market-data fetch. Entitlement math only -- does NOT validate DTC ISO 20022 message shape; that half is the message-shape validator (art-546), which chains into this node's input."
resource: https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.html
tags: ["compliance_mandate", "wave-84", "mcp:recompute_corporate_action_entitlement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-547-corporate-action-entitlement-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.html
    title: "public tool page"
---

# Corporate Action Entitlement Recompute

> Exports a decision via MCP `recompute_corporate_action_entitlement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DTC Corporate Actions ISO 20022 Message Validator](./art-546-dtcc-ca-iso20022-validator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-547-corporate-action-entitlement-recompute.md) — §10.2.
