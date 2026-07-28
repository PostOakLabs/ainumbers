---
type: DecisionTool
title: "Cash Forecast Accuracy Scoring"
description: "Scores treasury cash forecast accuracy per AFP Cash Forecasting Survey 2024 benchmarks. Computes MAPE and directional bias across T+1/T+7/T+30/T+90+ horizon buckets. Detects persistent timing bias (>75% same-sign errors over >=4 observations). Returns overall_accuracy_tier (EXCELLENT <5% / GOOD 5-10% / ACCEPTABLE 10-20% / POOR >20%), by_horizon breakdown, and timing_bias_detected. ZERO PII: aggregate monetary amounts only, no account-holder identifiers."
resource: https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.html
tags: ["analytics_mandate", "wave-44", "mcp:score_cash_forecast_accuracy"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-263-score-cash-forecast-accuracy.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.html
    title: "public tool page"
---

# Cash Forecast Accuracy Scoring

> Exports a decision via MCP `score_cash_forecast_accuracy` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ISO 20022 camt.053 Statement Reconciliation](./art-258-parse-camt053-reconciliation.md), [Hedge Effectiveness Test](./art-261-test-hedge-effectiveness.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-263-score-cash-forecast-accuracy.md) — §10.2.
