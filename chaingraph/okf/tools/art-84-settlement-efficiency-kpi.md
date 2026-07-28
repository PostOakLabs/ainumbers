---
type: DecisionTool
title: "Settlement Efficiency KPI Engine"
description: "Aggregates batch settlement data into CSDR/T+1-relevant KPIs: settlement rate, fail rate, total CSDR penalty cost, on-time allocation rate, SSI golden-source coverage, buy-in triggered count, and fail-duration distribution. Benchmarks against ESMA annual settlement-efficiency statistics (~97.5% EU average)."
resource: https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.html
tags: ["model_governance", "wave-17", "mcp:compute_settlement_efficiency_kpi"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-84-settlement-efficiency-kpi.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.html
    title: "public tool page"
---

# Settlement Efficiency KPI Engine

> Exports a decision via MCP `compute_settlement_efficiency_kpi` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CSDR Cash-Penalty Calculator](./art-78-csdr-penalty-calculator.md), [SSI Conformance Checker](./art-80-ssi-conformance-checker.md), [Settlement-Fail Predictor](./art-79-settlement-fail-predictor.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
