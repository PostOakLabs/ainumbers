---
type: DecisionTool
title: "Best-Execution NBBO Recompute"
description: "Recomputes, per supplied fill, price improvement in basis points against the NBBO at time of execution -- price_improvement_bps = (nbbo_ask - execution_price) / nbbo_ask * 10000 for buys, (execution_price - nbbo_bid) / nbbo_bid * 10000 for sells -- and whether each fill cleared at-or-better than the NBBO. Aggregates pct_at_or_better, avg_price_improvement_bps, and fill_count over a bounded fill set (capped at 5,000 fills). No customer/order identifiers accepted. Reg NMS best-execution obligations and FINRA Rule 5310 are the US crosswalk entry; the core recompute is the generic shape any best-execution regime ultimately checks. Attests the computation over caller-supplied inputs only, not an audit of those inputs or a determination of regulatory compliance."
resource: https://ainumbers.co/chaingraph/art-541-best-execution-recompute.html
tags: ["analytics_mandate", "wave-84", "mcp:recompute_best_execution"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-541-best-execution-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-541-best-execution-recompute.html
    title: "public tool page"
---

# Best-Execution NBBO Recompute

> Exports a decision via MCP `recompute_best_execution` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-541-best-execution-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-541-best-execution-recompute.md) — §10.2.
