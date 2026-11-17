---
type: DecisionTool
title: "ASC 606 Transaction Price Allocator"
description: "Allocates a declared transaction price across declared performance obligations by relative standalone selling price, in integer minor units, under the discount handling (spread proportionally, or assigned to declared obligation ids), rounding rule (largest remainder, or round half up with the remainder to the largest obligation) and residual approach (off, or on for one declared obligation) that the caller declares. Returns the allocated amount per obligation, summing exactly to the price, the relative share in basis points, the discount allocated, and flags for a negative or zero residual, a missing standalone selling price, a price below the total with no discount rule, an allocation above a declared cap, and INDETERMINATE when a required fact is missing. It never guesses a standalone selling price. The residual_candidate flag is the caller's declaration that the residual-approach conditions of ASC 606-10-32-34 hold for that obligation, and discount handling assign takes caller-declared ids that assert the 32-37 conditions hold; the kernel checks neither. Re-running with a new price is a fresh allocation, not the change-in-transaction-price treatment of 32-42 to 32-45. Largest-remainder rounding is a kernel convention, not a paragraph rule, and ssp_share_bps truncates so shares can sum to 9999. It does not decide the standalone selling prices, does not identify the performance obligations in a contract, and is not an accounting conclusion. Ids and integers only, no free text. Allocated amounts could be consumed by art-265 (amortize_asc606_commissions); no adjacency is declared here."
resource: https://ainumbers.co/chaingraph/art-834-asc606-transaction-price-allocator.html
tags: ["compliance_control", "wave-144", "mcp:allocate_asc606_transaction_price"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-834-asc606-transaction-price-allocator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-834-asc606-transaction-price-allocator.html
    title: "public tool page"
---

# ASC 606 Transaction Price Allocator

> Exports a decision via MCP `allocate_asc606_transaction_price` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-834-asc606-transaction-price-allocator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-834-asc606-transaction-price-allocator.md) — §10.2.
