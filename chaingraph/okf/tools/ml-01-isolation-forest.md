---
type: DecisionTool
title: "Isolation Forest Transaction Anomaly Detector"
description: "Native-JS Isolation Forest anomaly detection on synthetic transaction batches. 10-tree forest, 4-feature scoring (amount, hour, counterparty frequency, recency), anomaly score histogram, flagged transaction table. Zero-egress — no real transaction data transmitted. Chains from ART-05 (EU AI Act credit-scoring) and ART-10 (AMLA typology)."
resource: https://ainumbers.co/chaingraph/ml-01-isolation-forest.html
tags: ["risk_control", "wave-3", "mcp:detect_transaction_anomalies"]
timestamp: 2026-06-18T14:43:45.819Z
---

# Isolation Forest Transaction Anomaly Detector

> Exports a decision via MCP `detect_transaction_anomalies` — mandate type `risk_control`.

**Context:** EU AI Act high-risk system classification Aug 2026; AMLA 2024/1624 SAR obligations; FCA Consumer Duty ongoing

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/ml-01-isolation-forest.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act Credit-Scoring Conformity Pack](./art-05-eu-ai-act-credit-scoring-conformity.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
