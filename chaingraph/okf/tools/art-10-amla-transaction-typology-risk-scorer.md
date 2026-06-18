---
type: DecisionTool
title: "AMLA Transaction-Typology Risk Scorer"
description: "Scores a synthetic transaction graph against AML typologies and FATF Travel Rule predicates; exports an AML risk determination per account/cluster. Chains into CRY-01 for ZK proof of the same predicate — a uniquely coherent two-tool story."
resource: https://ainumbers.co/chaingraph/art-10-amla-transaction-typology-risk-scorer.html
tags: ["risk_control", "wave-1", "mcp:score_aml_typologies"]
timestamp: 2026-06-18T14:43:45.819Z
---

# AMLA Transaction-Typology Risk Scorer

> Exports a decision via MCP `score_aml_typologies` — mandate type `risk_control`.

**Deadline:** 2027-07-01 — EU AMLR full application July 2027; AMLA full operations 2028

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-10-amla-transaction-typology-risk-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ZK Compliance Proof Generator](./cry-01-zk-compliance-proof-generator.md), [VoP Batch Match-Rate Analyser](./art-11-vop-batch-match-rate-analyser.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md), [APP Fraud Graph Simulator](./mms-03-app-fraud-graph.md), [Isolation Forest Transaction Anomaly Detector](./ml-01-isolation-forest.md)
