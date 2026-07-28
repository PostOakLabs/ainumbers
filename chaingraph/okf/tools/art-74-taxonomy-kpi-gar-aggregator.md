---
type: DecisionTool
title: "Taxonomy KPI & Green Asset Ratio Aggregator"
description: "Rolls activity-level Taxonomy alignment (from ART-73) into entity KPIs: revenue/CapEx/OpEx aligned proportions and, for financial undertakings, the Green Asset Ratio (GAR) per the Disclosures Delegated Act denominator rules."
resource: https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.html
tags: ["model_governance", "wave-16", "mcp:aggregate_taxonomy_kpi_gar"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-74-taxonomy-kpi-gar-aggregator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.html
    title: "public tool page"
---

# Taxonomy KPI & Green Asset Ratio Aggregator

> Exports a decision via MCP `aggregate_taxonomy_kpi_gar` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU Taxonomy Alignment Scorer](./art-73-taxonomy-alignment-scorer.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
