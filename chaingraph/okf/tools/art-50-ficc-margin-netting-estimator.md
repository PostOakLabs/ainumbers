---
type: DecisionTool
title: "FICC Margin & Netting Estimator"
description: "DV01-bucket VaR proxy of the FICC VaR-based margin (VBM), the netting benefit of central vs bilateral clearing, cash-vs-repo cross-product netting, and the done-away uplift. Educational proxy - not the official FICC VBM calculator."
resource: https://ainumbers.co/chaingraph/art-50-ficc-margin-netting-estimator.html
tags: ["risk_parameter", "wave-11", "mcp:estimate_ficc_margin_netting"]
timestamp: 2026-07-14
---

# FICC Margin & Netting Estimator

> Exports a decision via MCP `estimate_ficc_margin_netting` — mandate type `risk_parameter`.

**Deadline:** 2027-06-30 — repo-margin economics (W-B).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-50-ficc-margin-netting-estimator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Treasury Clearing Fit Diagnostic](./art-48-treasury-clearing-fit-diagnostic.md), [Clearing Access Model Selector](./art-49-clearing-access-model-selector.md)

**Feeds:** [On-Chain Repo Haircut Calculator](./508-repo-haircut-collateral-calculator.md), [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md)
