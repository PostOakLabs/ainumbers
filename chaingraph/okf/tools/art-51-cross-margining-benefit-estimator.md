---
type: DecisionTool
title: "FICC-CME Cross-Margining Estimator"
description: "Estimates the initial-margin reduction from the FICC-CME cross-margining arrangement (customer expansion per SEC notice published 2025-12-22) by offsetting UST cash/repo DV01 against CME Treasury/SOFR futures DV01. Educational proxy."
resource: https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.html
tags: ["risk_parameter", "wave-11", "mcp:estimate_cross_margin_benefit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-51-cross-margining-benefit-estimator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.html
    title: "public tool page"
---

# FICC-CME Cross-Margining Estimator

> Exports a decision via MCP `estimate_cross_margin_benefit` — mandate type `risk_parameter`.

**Deadline:** 2027-06-30 — cross-margining benefit (W-C). FICC-CME customer expansion Dec 2025.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Treasury Clearing Fit Diagnostic](./art-48-treasury-clearing-fit-diagnostic.md)

**Feeds:** [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md), [Stress Test Engine](./qfa-03-stress-test-engine.md)
