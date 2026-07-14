---
type: DecisionTool
title: "Insurance Reporting Readiness Diagnostic"
description: "A-F insurance reporting readiness diagnostic across six dimensions: IFRS 17 measurement model election, CSM system implementation, risk-adjustment disclosure, Solvency II Pillar-3 QRT reporting, SII-IFRS 17 reconciliation, and ICS assessment for IAIGs. Returns readiness_grade (A-F), readiness_score (0-100), dimensions_met, and gaps list. Terminal node of the solvency-ii-reconciliation-and-capital chain. IFRS 17 + Solvency II + ICS. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-182-insurance-reporting-readiness-diagnostic.html
tags: ["compliance_mandate", "wave-32", "mcp:run_insurance_reporting_fit"]
timestamp: 2026-07-14
---

# Insurance Reporting Readiness Diagnostic

> Exports a decision via MCP `run_insurance_reporting_fit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-182-insurance-reporting-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [SII-IFRS 17 Reconciliation Bridger](./art-181-sii-ifrs17-reconciliation-bridger.md)

**Feeds:** _terminal node_
