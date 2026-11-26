---
type: DecisionTool
title: "Average Price Allocation"
description: "Average-price allocation for one block order executed in several fills. Given an ISO 4217 currency, a side (buy labels amounts as cost, sell as proceeds), up to 5,000 fills of price per share (decimal string, at most 8 decimals) and whole-share quantity, and up to 500 pseudonymous accounts with whole-share allocations that must sum exactly to the filled quantity, the node returns the total in minor units, the average price to 8 decimals, each account's amount before and after the residual, the signed residual and where it went, and an identity check: the final account amounts plus any unallocated residual equal the total. All arithmetic is exact integer arithmetic on scaled values with half-up rounding; there is no floating point on the computation path, so a fill at 1.005 rounds the way the decimal says. Minor units follow the ISO 4217 minor-unit column (JPY 0, BHD, KWD, OMR, TND and JOD 3, most codes 2); unknown codes and fills carrying a different currency are refused. Two declared amount bases: unrounded_average (default) and rounded_average_dp, which rounds the average to a declared 0 to 8 decimals first and requires an explicit residual rule. Two residual rules: assign_largest (the account with the most shares, ties to the first declared) and report_unallocated. The rounding basis and the residual rule are declared conventions of this tool, not a regulatory or fairness rule. Calculation check, not investment, legal or regulatory advice."
resource: https://ainumbers.co/chaingraph/art-857-average-price-allocation.html
tags: ["compliance_control", "wave-152", "mcp:allocate_average_price"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-857-average-price-allocation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-857-average-price-allocation.html
    title: "public tool page"
---

# Average Price Allocation

> Exports a decision via MCP `allocate_average_price` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-857-average-price-allocation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-857-average-price-allocation.md) — §10.2.
