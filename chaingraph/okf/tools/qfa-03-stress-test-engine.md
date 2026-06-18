---
type: DecisionTool
title: "Stress Test Engine"
description: "Multi-scenario stress testing across 6 historical crisis scenarios (GFC 2008, COVID Mar 2020, Dot-com Bust, Lehman Week, Rate Shock 2022, SVB Contagion 2023) with Monte Carlo per scenario. Equity/credit/rate factor decomposition, stressed VaR and ES, stress multiplier, recovery-day estimate. Chains from QFA-02 (VaR Engine). Feeds RCA-01 (FRTB IMA). Basel 3.1 Pillar 2 ICAAP / EBA GL/2018/04 / FRTB MAR30 stress calibration reference."
resource: https://ainumbers.co/chaingraph/qfa-03-stress-test-engine.html
tags: ["risk_parameter", "wave-4", "mcp:compute_stress_test_scenarios"]
timestamp: 2026-06-18T15:09:48.675Z
---

# Stress Test Engine

> Exports a decision via MCP `compute_stress_test_scenarios` — mandate type `risk_parameter`.

**Context:** Basel III Pillar 2 ICAAP ongoing; EBA GL/2018/04 stress scenario guidelines; FRTB-IMA UK Jan 2028 pre-validation

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/qfa-03-stress-test-engine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md)

**Feeds:** [FRTB IMA Expected Shortfall Pre-Validator](./rca-01-frtb-ima-pre-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
