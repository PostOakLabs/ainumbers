---
type: DecisionTool
title: "Conforming Loan Limit Check"
description: "FHFA annual conforming loan limit classifier. 2026 baseline: $832,750 (1-unit), $1,066,250 (2-unit), $1,288,800 (3-unit), $1,601,750 (4-unit). High-cost areas carry a ceiling at 150% of baseline; AK, HI, Guam and USVI receive a statutory uplift that raises their baseline to the same figure. Classifies a loan as conforming, super-conforming (the Enterprise high-balance category, above the area baseline and at or below the applicable high-cost limit) or jumbo. Fails closed with a null verdict and a named flag on an unsupported year or a missing loan amount. Accepts an optional county-level limit override from the FHFA full county loan limit list. Table version: FHFA-CLL-2026. Not lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds) or check_agency_eligibility_matrix (DU/LPA approval parameters)."
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
