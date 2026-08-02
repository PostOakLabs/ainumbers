---
type: DecisionTool
title: "N-Way Balance Closure Check"
description: "Takes three or more caller-declared balances for the same measure, at the same as-of moment, across named internal systems, and ENFORCES the arithmetic closure identity (A minus B) plus (B minus C) equals (A minus C) within a caller-declared tolerance. Reports every pairwise difference, the closure residual for every triple, which pair carries the break, and which system is the single consistent explanation for all breaking pairs. This is not a fourth balance display: three pairwise tables enforce nothing across each other, because the third difference is fully determined by the other two, and the residual is the test a dashboard leaves to a human. Where a firm already reconciles hop by hop, each hop's own reconciled difference can be declared as an independent input, and the node then checks that those hops close against each other and agree with the declared balances. Tolerance is always a declared input, never defaulted, since an unstated tolerance turns every rounding difference into a break. Residual within tolerance yields auto_pass; outside tolerance, or a pairwise break, or a declared hop that disagrees with the balances, yields review_required, which routes to an exception step and never blocks. Balances at differing or undeclared as-of moments yield a ran-stale execution state; fewer than three systems, an undeclared tolerance, or no designated authoritative system yields a did-not-run execution state rather than a degraded pass. Balances, hop differences and the tolerance are integer minor units, so the arithmetic is exact. Scoped to internal system-boundary hops inside one firm, ahead of any filing. Clause: BCBS 239 Principle 2 fn.16 (robust automated reconciliation where multiple systems are in use); BCBS 239 SS36(d) (reconcile to a designated authoritative source, never consumer to consumer)."
resource: https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.html
tags: ["compliance_control", "wave-81", "mcp:check_nway_balance_closure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-525-nway-balance-closure-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.html
    title: "public tool page"
---

# N-Way Balance Closure Check

> Exports a decision via MCP `check_nway_balance_closure` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-525-nway-balance-closure-check.md) — §10.2.
