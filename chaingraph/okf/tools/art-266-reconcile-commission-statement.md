---
type: DecisionTool
title: "Commission Statement Reconciler"
description: "Line-item reconciliation of expected vs. received commission payments per contract. Computes variance_amount and variance_pct per line. Sets has_discrepancy (bool) when any line exceeds the tolerance_pct threshold. Returns discrepancy_lines[] and summary totals. Gate signal for commission-integrity-and-amortization chain (has_discrepancy=true exits early). Zero PII by construction."
resource: https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.html
tags: ["compliance_mandate", "wave-45", "mcp:reconcile_commission_statement"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-266-reconcile-commission-statement.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.html
    title: "public tool page"
---

# Commission Statement Reconciler

> Exports a decision via MCP `reconcile_commission_statement` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Commission Hierarchy Validator](./art-264-validate-commission-hierarchy.md)

**Feeds:** [ASC 340-40 Commission Amortization](./art-265-amortize-asc606-commissions.md)
