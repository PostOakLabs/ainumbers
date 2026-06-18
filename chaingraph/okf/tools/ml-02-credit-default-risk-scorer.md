---
type: DecisionTool
title: "Credit Default Risk Scorer"
description: "Logistic regression PD scorer on synthetic loan portfolio with Basel 3.1 F-IRB / A-IRB / SA RWA comparison (BCBS d424 formula, Φ⁻¹ Horner rational approximation). AUC-ROC trapezoid, KS statistic, Gini coefficient (EBA GL/2017/16 model performance thresholds). Chains from ART-05 (EU AI Act conformity). Feeds SIM-03 (Basel RWA Scenario Modeler)."
resource: https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html
tags: ["credit_assessment", "wave-4", "mcp:score_credit_default_risk"]
timestamp: 2026-06-18T15:18:23.408Z
---

# Credit Default Risk Scorer

> Exports a decision via MCP `score_credit_default_risk` — mandate type `credit_assessment`.

**Deadline:** 2026-08-02 — EU AI Act Annex III Part 5(b) credit-scoring high-risk obligations — August 2026; EBA GL/2017/16 IRB model performance

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act Credit-Scoring Conformity Pack](./art-05-eu-ai-act-credit-scoring-conformity.md)

**Feeds:** [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
