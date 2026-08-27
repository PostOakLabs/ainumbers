---
type: DecisionTool
title: "Federal Withholding Calculator (Percentage Method)"
description: "Federal income tax withholding via the IRS Publication 15-T percentage method, Worksheet 1A, for a 2020-or-later Form W-4. tax_year is a required input and selects the edition: the 2026 Section 1 and 2025 Section 4 STANDARD Withholding Rate Schedules are both carried, and an absent or unsupported year fails closed with error unsupported_or_missing_tax_year rather than defaulting to an edition the caller never chose. Supports single/MFS, married filing jointly, and head of household, plus Step 3 dependents credit, Step 4(a) other income, Step 4(b) deductions, and Step 4(c) extra withholding. STANDARD Withholding Rate Schedules only; the Form W-4 Step 2 multiple-jobs checkbox table is out of scope. Federal only, not tax advice, state withholding out of scope. Feeds art-339-compute-gross-to-net as its federal_withholding_per_period input, which must be called with the same tax_year. Not compute_gross_to_net itself, which computes FICA and net pay."
resource: https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_federal_withholding"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-338-compute-federal-withholding.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.html
    title: "public tool page"
---

# Federal Withholding Calculator (Percentage Method)

> Exports a decision via MCP `compute_federal_withholding` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Gross-to-Net Payroll Calculator (FICA)](./art-339-compute-gross-to-net.md)

## Attested computation

[executor + attester binding](../computations/art-338-compute-federal-withholding.md) — §10.2.
