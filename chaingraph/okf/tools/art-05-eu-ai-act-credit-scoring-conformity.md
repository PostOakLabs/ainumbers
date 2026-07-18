---
type: DecisionTool
title: "EU AI Act Credit-Scoring Conformity Pack"
description: "Bias testing across protected characteristics (disparate impact ratios, equalized odds gaps), data-quality attestations, Article 11 technical-documentation skeleton, conformity self-assessment. Hard deadline 2 December 2027, per the Digital Omnibus amendments (June 2026)."
resource: https://ainumbers.co/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.html
tags: ["model_governance", "wave-1", "mcp:assess_ai_act_conformity"]
timestamp: 2026-07-14
---

# EU AI Act Credit-Scoring Conformity Pack

> Exports a decision via MCP `assess_ai_act_conformity` — mandate type `model_governance`.

**Deadline:** 2027-12-02 — EU AI Act Annex III Part 5(b) — credit-scoring high-risk obligations fully apply 2 December 2027, per the Digital Omnibus amendments (Parliament final approval, June 2026)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Isolation Forest Transaction Anomaly Detector](./ml-01-isolation-forest.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
