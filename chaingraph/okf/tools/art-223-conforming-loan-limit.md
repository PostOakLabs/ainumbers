---
type: DecisionTool
title: "Conforming Loan Limit Check"
description: "FHFA annual conforming loan limit classifier. 2026 baseline: $806,500 (1-unit), $1,032,650 (2-unit), $1,248,150 (3-unit), $1,550,400 (4-unit). High-cost county and AK/HI/Guam/USVI ceiling at 150% of baseline. Classifies loans as conforming, super-conforming, or jumbo. Accepts optional county-level limit override from FHFA FullCountyLoanLimitList2026.xlsx. Table version: FHFA-CLL-2026. Not lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds) or check_agency_eligibility_matrix (DU/LPA approval parameters)."
resource: https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html
tags: ["compliance_mandate", "wave-38", "mcp:check_conforming_loan_limit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-223-conforming-loan-limit.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html
    title: "public tool page"
---

# Conforming Loan Limit Check

> Exports a decision via MCP `check_conforming_loan_limit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agency Eligibility Matrix](./art-222-agency-eligibility-matrix.md)

## Attested computation

[executor + attester binding](../computations/art-223-conforming-loan-limit.md) — §10.2.
