---
type: DecisionTool
title: "FRTB IMA Expected Shortfall Pre-Validator"
description: "FRTB IMA Expected Shortfall pre-validation: MC simulation across liquidity horizons LH1–LH5 (10/20/40/60/120 days), NMRF surcharge estimation, PLA Test (green/amber/red), IMA vs SA floor capital comparison. Educational pre-validator ahead of UK IMA go-live January 2028."
resource: https://ainumbers.co/chaingraph/rca-01-frtb-ima-pre-validator.html
tags: ["risk_parameter", "wave-3", "mcp:simulate_frtb_es"]
timestamp: 2026-06-18T13:58:30.949Z
---

# FRTB IMA Expected Shortfall Pre-Validator

> Exports a decision via MCP `simulate_frtb_es` — mandate type `risk_parameter`.

**Deadline:** 2028-01-01 — UK FRTB-IMA go-live January 2028; EU slipped to ~2029-30. Pre-validation educational tool.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/rca-01-frtb-ima-pre-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md), [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
