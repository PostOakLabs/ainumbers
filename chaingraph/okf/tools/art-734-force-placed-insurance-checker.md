---
type: DecisionTool
title: "Force-Placed Insurance Notice Checker"
description: "Checks a lender-placed (force-placed) insurance event against the notice sequence required before a servicer may charge the borrower: the 45-day advance first notice with its prescribed content set, the reminder notice at least 15 days before the charge and at least 30 days after the first notice, and the no-evidence-of-continuous-coverage precondition; evaluates the 15-day cancellation-and-refund clock with a pro-rata overlapping-coverage refund computed from values; and reports the charged premium against borrower-provided alternative-quote values as a values-only comparison table. Every element carries its paragraph citation. Missing quote values, invalid dates and amounts, and inverted coverage periods are refused, never computed. The node never labels a premium reasonable or unreasonable; the comparison is surfaced, the judgement is not."
resource: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.html
tags: ["consumer_finance", "wave-132", "mcp:check_force_placed_notice"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-734-force-placed-insurance-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.html
    title: "public tool page"
---

# Force-Placed Insurance Notice Checker

> Exports a decision via MCP `check_force_placed_notice` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-734-force-placed-insurance-checker.md) — §10.2.
