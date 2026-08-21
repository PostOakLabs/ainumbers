---
type: DecisionTool
title: "Interest Accrual Recompute"
description: "Recomputes per-day interest accrual from caller-supplied daily principal balances and product terms (day-count convention, compounding basis, fixed or tiered rate), then diffs the recomputed cumulative accrual against the core's own posted accrual/interest-paid ledger entries at each of the core's own posting dates. Returns MATCHES, DIVERGES with the first divergent date and cent amount, or INDETERMINATE when no core postings exist to diff against. An independent recompute-and-receipt over a caller-declared contract term (day-count/compounding), not an audit of or substitution for any core platform, and not a claim about which convention a core should use."
resource: https://ainumbers.co/tools/661-interest-accrual-recompute.html
tags: ["compliance_control", "wave-109", "mcp:compute_interest_accrual_recompute"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-661-interest-accrual-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/661-interest-accrual-recompute.html
    title: "public tool page"
---

# Interest Accrual Recompute

> Exports a decision via MCP `compute_interest_accrual_recompute` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/661-interest-accrual-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-661-interest-accrual-recompute.md) — §10.2.
