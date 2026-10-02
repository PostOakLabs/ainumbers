---
type: DecisionTool
title: "Three Way Invoice Match"
description: "Matches one invoice against its purchase order and its goods receipt and decides whether the invoice can be paid: every invoice line is paired to an unused PO line by the declared po_line, then by exact sku, then by a free same-number PO line (no fuzzy text matching anywhere), and each paired line takes the first verdict that applies in a fixed order: quantity over received, receipt missing (a two-way match, reported as a flag rather than a failure), quantity over ordered, or unit price outside the declared basis-point tolerance, where a variance exactly at the tolerance passes. Totals are recomputed in integer minor units: the line sum against the declared subtotal, tax from one declared rate under half-up integer rounding, and the total from those two. Prior invoices from the same vendor are screened for duplicates on same total inside the declared day window, the same normalized invoice number (lowercased, non-alphanumerics stripped, leading letters and zeros stripped), or the same PO, with the likely-duplicate rule fixed in advance. Any of fractional quantities, sub-minor-unit prices, negative or non-integer money, duplicate line numbers, an unknown tax rounding, or a missing currency is refused with a named reason, never rounded or coerced. Scope limits: one currency per invoice, one declared tax rate with no tax-jurisdiction logic, and day differences from integer days-from-civil arithmetic with no clock; no goods receipt at all downgrades the run to a two-way match and is reported, not failed."
resource: https://ainumbers.co/chaingraph/art-701-three-way-invoice-match.html
tags: ["compliance_control", "wave-120", "mcp:match_invoice_three_way"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-701-three-way-invoice-match.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-701-three-way-invoice-match.html
    title: "public tool page"
---

# Three Way Invoice Match

> Exports a decision via MCP `match_invoice_three_way` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-701-three-way-invoice-match.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-701-three-way-invoice-match.md) — §10.2.
