---
type: DecisionTool
title: "DORA Readiness Diagnostic"
description: "12-question scored diagnostic across four DORA pillars (ICT risk management, incident classification & reporting, resilience testing, third-party risk). Graded A–F with remediation map. Single-node ChainGraph (chain_depth: 0). Common entry point for the DORA Readiness Chain — diagnostic grade determines scenario routing (A/B/C). Promoted from guides/dora-readiness-diagnostic.html."
resource: https://ainumbers.co/chaingraph/art-29-dora-readiness-diagnostic.html
tags: ["infrastructure_mandate", "wave-B", "mcp:run_dora_readiness_diagnostic"]
timestamp: 2026-06-18T13:58:30.949Z
---

# DORA Readiness Diagnostic

> Exports a decision via MCP `run_dora_readiness_diagnostic` — mandate type `infrastructure_mandate`.

**Context:** DORA (EU) 2022/2554 in force January 2025 — ~22,000 in-scope entities

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-29-dora-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [DORA Major-Incident Reporting Threshold Classifier](./art-09-dora-incident-classifier.md), [DORA ICT Cascade Simulator](./pnr-01-dora-ict-cascade-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
