---
type: DecisionTool
title: "ASC 340-40 Commission Amortization"
description: "Computes ASC 340-40-25-4 practical expedient (contract_term_months <= 12 -> expense immediately, apply_expedient=true) and full straight-line amortization schedules for longer-term capitalized incremental costs of obtaining a contract under ASC 606. Returns apply_expedient (bool), monthly_amortization, cumulative_amortized_pct, and remaining_book_value per commission line. Zero PII by construction."
resource: https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.html
tags: ["compliance_mandate", "wave-45", "mcp:amortize_asc606_commissions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-265-amortize-asc606-commissions.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.html
    title: "public tool page"
---

# ASC 340-40 Commission Amortization

> Exports a decision via MCP `amortize_asc606_commissions` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Commission Statement Reconciler](./art-266-reconcile-commission-statement.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-265-amortize-asc606-commissions.md) — §10.2.
