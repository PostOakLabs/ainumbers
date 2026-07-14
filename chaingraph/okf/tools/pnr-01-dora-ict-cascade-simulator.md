---
type: DecisionTool
title: "DORA ICT Cascade Simulator"
description: "Monte Carlo cascade simulation of ICT incident propagation across a financial-institution dependency graph under DORA (EU) 2022/2554. 500 stochastic BFS paths; models failure propagation, recovery, and concentration risk."
resource: https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.html
tags: ["infrastructure_mandate", "wave-3", "mcp:simulate_ict_cascade"]
timestamp: 2026-07-14
---

# DORA ICT Cascade Simulator

> Exports a decision via MCP `simulate_ict_cascade` — mandate type `infrastructure_mandate`.

**Context:** DORA (EU) 2022/2554 in force January 2025; TLPT requirements ongoing

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DORA Major-Incident Reporting Threshold Classifier](./art-09-dora-incident-classifier.md)

**Feeds:** [Open Banking Consent Flow Stress Simulator](./sim-07-open-banking-consent-flow-stress.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
