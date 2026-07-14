---
type: DecisionTool
title: "LLPA Stack Calculator"
description: "Fannie Mae public LLPA (Loan-Level Price Adjustment) matrix calculator. FICO-by-LTV base grid plus feature surcharges: cash-out refinance, second home, investment property, warrantable condo, subordinate financing. Applies FTHB AMI waiver (SEL-2023-07, up to 1.75 pp reduction for first-time buyers at or below 100% AMI). Table version: FNM-LLPA-2025-11-01 (Fannie Mae public publication). Not check_agency_eligibility_matrix (DU/LPA approval grid) or check_conforming_loan_limit (FHFA size limits)."
resource: https://ainumbers.co/chaingraph/art-221-llpa-stack.html
tags: ["compliance_mandate", "wave-38", "mcp:compute_llpa_stack"]
timestamp: 2026-07-14
---

# LLPA Stack Calculator

> Exports a decision via MCP `compute_llpa_stack` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-221-llpa-stack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agency Eligibility Matrix](./art-222-agency-eligibility-matrix.md)

**Feeds:** _terminal node_
