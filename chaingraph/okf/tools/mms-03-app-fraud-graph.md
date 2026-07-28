---
type: DecisionTool
title: "APP Fraud Graph Simulator"
description: "Monte Carlo BFS simulation of Authorised Push Payment (APP) fraud propagation across a payment-account graph. UK PSR reimbursement framing. Zero-egress."
resource: https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html
tags: ["aml_rule", "wave-3", "mcp:simulate_app_fraud_graph"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/mms-03-app-fraud-graph.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html
    title: "public tool page"
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

## Attested computation

[executor + attester binding](../computations/mms-03-app-fraud-graph.md) — §10.2.
