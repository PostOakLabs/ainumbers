---
type: DecisionTool
title: "Portfolio Covariance & VaR Engine"
description: "VaR and Expected Shortfall: Historical Simulation, Parametric (variance-covariance), and Monte Carlo with Cholesky 2-factor correlation structure. P&L histogram (30 bins), 8×8 covariance heatmap. 500 assets, seeded LCG RNG. Buy-side zero-egress story."
resource: https://ainumbers.co/chaingraph/qfa-02-portfolio-var-engine.html
tags: ["risk_control", "wave-2", "mcp:compute_portfolio_var"]
timestamp: 2026-06-18T15:15:44.978Z
---

# Portfolio Covariance & VaR Engine

> Exports a decision via MCP `compute_portfolio_var` — mandate type `risk_control`.

**Context:** Buy-side; pre-validation ahead of FRTB-IMA UK Jan 2028

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/qfa-02-portfolio-var-engine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md)

**Feeds:** [Stress Test Engine](./qfa-03-stress-test-engine.md), [FRTB IMA Expected Shortfall Pre-Validator](./rca-01-frtb-ima-pre-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
