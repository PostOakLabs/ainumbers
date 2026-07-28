---
type: DecisionTool
title: "Credit Default Risk Scorer"
description: "Logistic regression PD scorer on synthetic loan portfolio with Basel 3.1 F-IRB / A-IRB / SA RWA comparison (BCBS d424 formula, Φ⁻¹ Horner rational approximation). AUC-ROC trapezoid, KS statistic, Gini coefficient (EBA GL/2017/16 model performance thresholds). Chains from ART-05 (EU AI Act conformity). Feeds SIM-03 (Basel RWA Scenario Modeler)."
resource: https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html
tags: ["credit_assessment", "wave-4", "mcp:score_credit_default_risk"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/ml-02-credit-default-risk-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html
    title: "public tool page"
---

# Credit Default Risk Scorer

> Exports a decision via MCP `score_credit_default_risk` — mandate type `credit_assessment`.

**Deadline:** 2027-12-02 — EU AI Act Annex III Part 5(b) credit-scoring high-risk obligations — 2 December 2027, per the Digital Omnibus amendments (June 2026); EBA GL/2017/16 IRB model performance

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act Credit-Scoring Conformity Pack](./art-05-eu-ai-act-credit-scoring-conformity.md)

**Feeds:** [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
