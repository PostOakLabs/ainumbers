---
type: DecisionTool
title: "Total Cost of Homeownership"
description: "Total cost of homeownership comparator ported from ApexLogics Apex #153 (AL-167). Given purchase price, loan terms, recurring costs, growth assumptions and a hold period, the node amortizes the mortgage month by month (art-332/626 pattern), charges mortgage insurance while the post-payment loan-to-value is strictly above a drop threshold (art-336 pattern), grows property tax, insurance, maintenance, HOA and utilities year by year, applies the interest-plus-SALT deduction offset at the caller's marginal rate, compounds the opportunity cost of cash at close (art-661 pattern), and returns gross and net cost of ownership over the hold, break-even monthly rent and a cost-composition breakdown in basis points. Only a hold under one year is refused (REFUSED_BAD_HOLD_YEARS); a refusal carries the same payload keys as a success. Declared divergences from the ported page: the SALT cap fallback stays at the Apex $10,000 for vector fidelity while the official 2026 figure is $40,400 (26 USC 164(b)(7)); the 78 percent automatic MI-termination leg of the Homeowners Protection Act is not modeled (80 percent borrower cancellation only); the deduction benefit omits the itemize-versus-standard threshold and the acquisition-indebtedness limit (payload DIFFERS.md D1-D4, H0-H3)."
resource: https://ainumbers.co/chaingraph/art-770-total-cost-of-homeownership.html
tags: ["consumer_finance", "wave-134", "mcp:total_cost_of_homeownership"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-770-total-cost-of-homeownership.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-770-total-cost-of-homeownership.html
    title: "public tool page"
---

# Total Cost of Homeownership

> Exports a decision via MCP `total_cost_of_homeownership` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-770-total-cost-of-homeownership.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-770-total-cost-of-homeownership.md) — §10.2.
