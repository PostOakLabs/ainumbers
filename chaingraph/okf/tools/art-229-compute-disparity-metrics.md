---
type: DecisionTool
title: "Compute Disparate Impact Metrics"
description: "Computes three fair lending disparate impact metrics from aggregate lending counts: 4/5ths (80%) rule (adverse_impact_ratio) per EEOC 29 CFR §1607.4(D), z-statistic for statistical significance of the approval-rate difference, and standardised mean difference (Cohen's d). Inputs are aggregate counts only; no individual applicant records, names, demographic identifiers, or scores. ZERO PII BY CONSTRUCTION. EEOC Uniform Guidelines on Employee Selection Procedures (29 CFR §1607), HMDA/Reg C."
resource: https://ainumbers.co/chaingraph/art-229-compute-disparity-metrics.html
tags: ["compliance_mandate", "wave-39", "mcp:compute_disparity_metrics"]
timestamp: 2026-07-14
---

# Compute Disparate Impact Metrics

> Exports a decision via MCP `compute_disparity_metrics` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-229-compute-disparity-metrics.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Compute HMDA Rate Spread](./art-230-compute-hmda-rate-spread.md)

**Feeds:** _terminal node_
