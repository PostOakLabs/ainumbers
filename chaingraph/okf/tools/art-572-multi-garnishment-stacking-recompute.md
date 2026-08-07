---
type: DecisionTool
title: "Multi-Garnishment Stacking Recomputation"
description: "Recomputes, for one stated pay period, how much of an employee's disposable earnings each order in a caller-declared garnishment stack may lawfully withhold, then compares the recomputed per-order withholding against a garnishment notice where one is supplied. Both an employer computing what to withhold and an employee or legal-aid clinic recomputing a notice they received can run the same arithmetic; neither side is privileged. Disposable earnings are computed from caller-supplied gross earnings less legally-required deductions. Each order type carries its own statutory cap: child-support orders use the CCPA Title III tiers of 50, 55, 60 or 65 percent keyed on arrears over 12 weeks and a second family; a federal tax levy is exempt from the CCPA percentage limitations and is capped here only at remaining disposable earnings, with the IRS wage-bracket exempt-amount table named as out of scope; a state levy uses a caller-declared percentage where supplied and otherwise defaults to the general CCPA cap, with no fifty-state table bundled; an HEA Administrative Wage Garnishment order is capped at 15 percent of disposable earnings and by the 30-times-federal-minimum-wage floor; and creditor and other orders use the general CCPA cap of 25 percent or the 30-times floor, whichever is less. Orders are withheld in the priority order the caller supplies, subject to each order's own cap and an aggregate ceiling equal to the single highest individual cap present in the stack, a documented simplification named in the artifact's not_proven list. A dated, caller-overridable federal minimum wage prefill feeds the 30-times floor. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty order stack and a run where no noticed withholding amounts were supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites the Consumer Credit Protection Act Title III, 29 CFR Part 870, DOL Fact Sheet 30, and 34 CFR Part 34 for the Administrative Wage Garnishment cap, each dated for re-verification against primary text. Stated boundary: this is not legal advice, and a divergence against a supplied notice is an arithmetic finding about the order stack and figures supplied here, never a determination that any order is valid, enforceable, or correctly served."
resource: https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.html
tags: ["analytics_mandate", "wave-96", "mcp:recompute_garnishment_stack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-572-multi-garnishment-stacking-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.html
    title: "public tool page"
---

# Multi-Garnishment Stacking Recomputation

> Exports a decision via MCP `recompute_garnishment_stack` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-572-multi-garnishment-stacking-recompute.md) — §10.2.
