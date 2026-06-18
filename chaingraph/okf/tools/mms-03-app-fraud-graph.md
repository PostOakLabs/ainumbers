---
type: DecisionTool
title: "APP Fraud Graph Simulator"
description: ""
resource: https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html
tags: ["aml_rule", "wave-3", "mcp:simulate_app_fraud_graph"]
timestamp: 2026-06-18T15:18:23.408Z
---

# APP Fraud Graph Simulator

> Exports a decision via MCP `simulate_app_fraud_graph` — mandate type `aml_rule`.

**Context:** UK PSR Reimbursement Policy Oct 2024 (£85k cap) — live obligation; EBA fraud monitoring guidelines ongoing

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DORA Major-Incident Reporting Threshold Classifier](./art-09-dora-incident-classifier.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
