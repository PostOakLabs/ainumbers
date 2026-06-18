---
type: DecisionTool
title: "DORA ICT Cascade Simulator"
description: ""
resource: https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.html
tags: ["infrastructure_mandate", "wave-3", "mcp:simulate_ict_cascade"]
timestamp: 2026-06-18T15:18:23.408Z
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
