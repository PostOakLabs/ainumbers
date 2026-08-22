---
type: DecisionTool
title: "Ownership 50%-Rule Aggregator"
description: "Walks a synthetic ownership graph; computes direct + indirect + aggregate listed stakes per node; applies OFAC, EU, and BIS Affiliates Rule (in force 29 Sep 2025) 50%-thresholds to determine constructively-blocked entities. Ownership percentage is the only relation the inputs carry: there is no control edge and no control flag, so control without ownership is excluded from scope. OFAC FAQs 398 and 400 treat an entity that a blocked person controls without owning 50 percent or more as not itself blocked while still counselling caution, and that branch is not evaluated here. The EU criterion is ownership or control, and the eu_50 threshold expresses its ownership prong only; the EU control prong is excluded on the same ground. Pure graph math, synthetic entities only."
resource: https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.html
tags: ["compliance_mandate", "wave-19", "mcp:aggregate_ownership_50pct"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-91-ownership-50pct-aggregator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.html
    title: "public tool page"
---

# Ownership 50%-Rule Aggregator

> Exports a decision via MCP `aggregate_ownership_50pct` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Sanctions & Export-Control Screening Fit Diagnostic](./art-90-sanctions-screening-fit-diagnostic.md)

**Feeds:** [Screening List-Coverage Checker](./art-92-screening-list-coverage-checker.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-91-ownership-50pct-aggregator.md) — §10.2.
