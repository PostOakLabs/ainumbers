---
type: DecisionTool
title: "Private Student Loan Disclosure & Rescission Checker"
description: "Checks a private-education-loan disclosure-element checklist across the three 12 CFR 1026.46-48 stages (application/solicitation, approval, final), the HEOA self-certification-form presence requirement, and computes the 3-business-day right-to-cancel window from a declared final-disclosure date (skipping weekends and any declared holiday dates). Federal Income-Driven Repayment (IDR) calculations are explicitly out of scope v1 -- flagged as a future rider trigger, not built, because those formulas churn on a policy cycle distinct from the stable 1026.46-48 requirements checked here."
resource: https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.html
tags: ["compliance_mandate", "wave-60", "mcp:check_private_student_loan_disclosures"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-405-check-private-student-loan-disclosures.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.html
    title: "public tool page"
---

# Private Student Loan Disclosure & Rescission Checker

> Exports a decision via MCP `check_private_student_loan_disclosures` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-405-check-private-student-loan-disclosures.md) — §10.2.
