---
type: DecisionTool
title: "Agency Eligibility Matrix"
description: "Fannie Mae DU and Freddie Mac LPA agency eligibility matrix. Checks DTI caps (DU/LPA: 50%; manual UW: 36% housing / 45% total), LTV/CLTV/HCLTV maximums by occupancy type (primary/second home/investment) and loan purpose (purchase/rate-term/cash-out), and multi-unit property constraints. Returns eligible_flag (ELIGIBLE or INELIGIBLE) and detailed per-check results. Table version: FNM-LPA-ELIGIBILITY-2026-01-01. Not compute_llpa_stack (LLPA pricing surcharges) or check_conforming_loan_limit (FHFA loan size limits)."
resource: https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html
tags: ["compliance_mandate", "wave-38", "mcp:check_agency_eligibility_matrix"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-222-agency-eligibility-matrix.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html
    title: "public tool page"
---

# Agency Eligibility Matrix

> Exports a decision via MCP `check_agency_eligibility_matrix` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Conforming Loan Limit Check](./art-223-conforming-loan-limit.md)

**Feeds:** [LLPA Stack Calculator](./art-221-llpa-stack.md)
