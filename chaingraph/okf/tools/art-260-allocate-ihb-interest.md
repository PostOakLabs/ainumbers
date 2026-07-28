---
type: DecisionTool
title: "IHB Interest Allocation"
description: "Allocates overnight in-house-bank (IHB) interest across notional pool or ZBA sweep members. OECD Transfer Pricing Guidelines 2022 Chapter X arm's-length rate. Supports ACT/360, ACT/365, and 30/360 day-count conventions. Per-member withholding tax deduction. Returns per-member gross_interest, withholding_amount, net_interest, and total_interest_allocated. ZERO PII: member IDs are entity references only, no personal account-holder data."
resource: https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.html
tags: ["analytics_mandate", "wave-44", "mcp:allocate_ihb_interest"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-260-allocate-ihb-interest.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.html
    title: "public tool page"
---

# IHB Interest Allocation

> Exports a decision via MCP `allocate_ihb_interest` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Multilateral Cash Netting](./art-259-compute-multilateral-netting.md), [eBAM Account Message Flow Validation](./art-262-validate-ebam-acmt-flow.md)

**Feeds:** _terminal node_
