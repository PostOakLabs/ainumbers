---
type: DecisionTool
title: "IFRS 17 Risk Adjustment Checker"
description: "Check IFRS 17 risk-adjustment (RA) disclosure completeness: validates technique (VaR/CTE/CoC/other per IFRS 17 para 119b), confidence-level disclosure for VaR and CTE techniques, positive RA amount, and onerous-contract loss-component recognition (IFRS 17 para 47-50). Returns ra_valid flag, technique_ok, gaps list, and onerous_properly_handled indicator. Terminal node of the ifrs17-measurement-conformance chain. IFRS 17 para 56-57 and 119. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-179-ifrs17-risk-adjustment-checker.html
tags: ["compliance_mandate", "wave-32", "mcp:check_ifrs17_risk_adjustment"]
timestamp: 2026-07-14
---

# IFRS 17 Risk Adjustment Checker

> Exports a decision via MCP `check_ifrs17_risk_adjustment` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-179-ifrs17-risk-adjustment-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IFRS 17 CSM Roll-Forward Validator](./art-178-ifrs17-csm-rollforward-validator.md)

**Feeds:** _terminal node_
