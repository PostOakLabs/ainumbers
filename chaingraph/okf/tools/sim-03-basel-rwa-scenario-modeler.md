---
type: DecisionTool
title: "Basel RWA Scenario Modeler"
description: "SA-CR / F-IRB / A-IRB RWA in parallel with output-floor comparison (72.5% §CAP30). BCBS d424 IRB capital formula with Φ⁻¹ rational approximation, LCG Monte Carlo. Percentile table P5–P99. Three portfolio mixes."
resource: https://ainumbers.co/chaingraph/sim-03-basel-rwa-scenario-modeler.html
tags: ["capital_assessment", "wave-2", "mcp:compute_rwa_scenarios"]
timestamp: 2026-06-18T12:19:38.802Z
---

# Basel RWA Scenario Modeler

> Exports a decision via MCP `compute_rwa_scenarios` — mandate type `capital_assessment`.

**Deadline:** 2027-01-01 — Basel 3.1 output floor — UK PRA PS1/26 January 1, 2027

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/sim-03-basel-rwa-scenario-modeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Basel 3.1 Reporting Delta Calculator](./art-07-basel31-reporting-delta-calculator.md)

**Feeds:** [Time-Series Anomaly Detector](./ml-03-timeseries-anomaly-detector.md), [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md), [FRTB IMA Expected Shortfall Pre-Validator](./rca-01-frtb-ima-pre-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
