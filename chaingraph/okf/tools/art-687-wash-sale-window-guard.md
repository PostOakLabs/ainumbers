---
type: DecisionTool
title: "Wash-Sale Window Guard"
description: "Computes a wash-sale window screen from caller-declared synthetic inputs: the 61-day acquisition window of the declared wash-sale method (sale date minus 30 days through sale date plus 30 days, inclusive; 26 U.S.C. 1091(a), cited informatively) is applied to a declared lot sale and a declared replacement-purchase list. The node totals the disallowed loss (2 decimal places, half-up, restated in a trace), flags a replacement account declared tax-deferred inside the window (the IRA-trap case, where the disallowed loss is treated as permanently lost rather than deferred; Rev. Rul. 2008-5, cited informatively), and raises a basis-carryforward flag on the flagged taxable path (26 U.S.C. 1091(d), cited informatively). The verdict reports the declared arithmetic only (WASH_SALE_FLAGGED, WASH_SALE_CLEAR). Undated or malformed lots fail closed. This is a deterministic calculator over declared numbers: it is never advice, never an optimizer, and it renders no tax position on any real holding. Zero storage, zero network, no runtime clock."
resource: https://ainumbers.co/chaingraph/art-687-wash-sale-window-guard.html
tags: ["compliance_control", "wave-116", "mcp:compute_wash_sale_window_guard"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-687-wash-sale-window-guard.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-687-wash-sale-window-guard.html
    title: "public tool page"
---

# Wash-Sale Window Guard

> Exports a decision via MCP `compute_wash_sale_window_guard` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-687-wash-sale-window-guard.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-687-wash-sale-window-guard.md) — §10.2.
