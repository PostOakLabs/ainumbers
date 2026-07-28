---
type: DecisionTool
title: "Ownership 50%-Rule Aggregator"
description: "Walks a synthetic ownership graph; computes direct + indirect + aggregate listed stakes per node; applies OFAC, EU, and BIS Affiliates Rule (in force 29 Sep 2025) 50%-thresholds to determine constructively-blocked entities. Pure graph math, synthetic entities only."
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
