---
type: DecisionTool
title: "Hedge Effectiveness Test"
description: "ASC 815-20-35 retrospective hedge effectiveness test. Computes dollar-offset ratio (fair-value change of hedging instrument / hedged item, must be 80-125%) and OLS R-squared regression (must be >=0.8) using pure deterministic arithmetic -- no Math.sqrt/log/pow transcendentals. RFC 3161 anchor surface for timestamped hedge designation evidence. Emits is_effective (bool), offset_ratio_pct, r_squared, and compliance_flags. ZERO PII: price series data only."
resource: https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.html
tags: ["compliance_mandate", "wave-44", "mcp:test_hedge_effectiveness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-261-test-hedge-effectiveness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.html
    title: "public tool page"
---

# Hedge Effectiveness Test

> Exports a decision via MCP `test_hedge_effectiveness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Cash Forecast Accuracy Scoring](./art-263-score-cash-forecast-accuracy.md)

## Attested computation

[executor + attester binding](../computations/art-261-test-hedge-effectiveness.md) — §10.2.
