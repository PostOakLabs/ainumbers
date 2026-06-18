---
type: DecisionTool
title: "Time-Series Anomaly Detector"
description: "Rolling-window z-score and STL-style seasonal decomposition anomaly detection on synthetic payment volume time series. Control chart (UCL/LCL 3σ), trend/seasonal/residual panel decomposition, anomaly flag table with severity, naïve ARIMA-lite 30-period forecast. Chains from SIM-03 (Basel RWA Scenario Modeler). Feeds RCA-01 (FRTB IMA). DORA Art.17 monitoring / EBA GL/2021/03 operational risk / PSD2 Art.96 fraud reporting."
resource: https://ainumbers.co/chaingraph/ml-03-timeseries-anomaly-detector.html
tags: ["risk_control", "wave-4", "mcp:detect_timeseries_anomalies"]
timestamp: 2026-06-18T15:15:44.978Z
---

# Time-Series Anomaly Detector

> Exports a decision via MCP `detect_timeseries_anomalies` — mandate type `risk_control`.

**Context:** DORA Art.17 ICT-risk monitoring in force Jan 2025; EBA GL/2021/03 operational risk guidelines; PSD2 Art.96 fraud reporting ongoing

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/ml-03-timeseries-anomaly-detector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md)

**Feeds:** [FRTB IMA Expected Shortfall Pre-Validator](./rca-01-frtb-ima-pre-validator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
