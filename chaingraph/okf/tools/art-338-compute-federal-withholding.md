---
type: DecisionTool
title: "Federal Withholding Calculator (Percentage Method)"
description: "Federal income tax withholding via the IRS Publication 15-T (2025) percentage method, Worksheet 1A, for a 2020-or-later Form W-4. Supports single/MFS, married filing jointly, and head of household, plus Step 3 dependents credit, Step 4(a) other income, Step 4(b) deductions, and Step 4(c) extra withholding. STANDARD Withholding Rate Schedules only; the Form W-4 Step 2 multiple-jobs checkbox table is out of scope for v1. Federal only, not tax advice, state withholding out of scope. Feeds art-339-compute-gross-to-net as its federal_withholding_per_period input. Not compute_gross_to_net itself, which adds FICA and produces net pay."
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
