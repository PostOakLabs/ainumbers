---
type: DecisionTool
title: "EU Taxonomy Alignment Scorer"
description: "Scores an economic activity against an environmental objective: substantial-contribution technical-screening criteria + DNSH across the other five objectives + minimum safeguards -> aligned / eligible-but-not-aligned / not-eligible. Taxonomy Omnibus I revisions in force 28 Jan 2026."
resource: https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.html
tags: ["compliance_mandate", "wave-16", "mcp:score_taxonomy_alignment"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-73-taxonomy-alignment-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.html
    title: "public tool page"
---

# EU Taxonomy Alignment Scorer

> Exports a decision via MCP `score_taxonomy_alignment` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md)

**Feeds:** [Taxonomy KPI & Green Asset Ratio Aggregator](./art-74-taxonomy-kpi-gar-aggregator.md), [EU Green Bond Factsheet & Allocation Validator](./art-75-eugb-factsheet-validator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-73-taxonomy-alignment-scorer.md) — §10.2.
