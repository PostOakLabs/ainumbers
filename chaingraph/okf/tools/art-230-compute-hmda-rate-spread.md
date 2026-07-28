---
type: DecisionTool
title: "Compute HMDA Rate Spread"
description: "Computes the HMDA rate spread (APR minus APOR) per FFIEC methodology and classifies against HMDA reportability thresholds: 1.5 pp (first lien), 3.5 pp (subordinate lien), 6.5 pp (HELOC). Outputs rate_spread_pct, lien classification, is_reportable flag, and HPML indicator (1.5 pp first / 3.5 pp sub, triggers escrow and appraisal requirements under TILA). Table version: FFIEC-RATE-SPREAD-METHODOLOGY-2023."
resource: https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.html
tags: ["compliance_mandate", "wave-39", "mcp:compute_hmda_rate_spread"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-230-compute-hmda-rate-spread.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.html
    title: "public tool page"
---

# Compute HMDA Rate Spread

> Exports a decision via MCP `compute_hmda_rate_spread` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Compute Disparate Impact Metrics](./art-229-compute-disparity-metrics.md)
