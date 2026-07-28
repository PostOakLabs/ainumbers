---
type: DecisionTool
title: "Gross-to-Net Payroll Calculator (FICA)"
description: "Gross-to-net payroll calculation: FICA (Social Security 6.2% up to the 2025 $176,100 wage base, Medicare 1.45% uncapped, Additional Medicare Tax 0.9% on cumulative wages over $200,000 per IRC 3101(b)(2)), pretax deduction ordering (401(k)/HSA/Section 125 reduce both FICA and federal-taxable wages), and net pay. federal_withholding_per_period is a declared input, normally fed from art-338-compute-federal-withholding's output, since kernels cannot import one another. Federal only, not tax advice, state withholding and state payroll taxes out of scope. Consumes art-338-compute-federal-withholding. Not compute_federal_withholding itself, which only computes the federal income tax withholding line."
resource: https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_gross_to_net"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-339-compute-gross-to-net.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.html
    title: "public tool page"
---

# Gross-to-Net Payroll Calculator (FICA)

> Exports a decision via MCP `compute_gross_to_net` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Federal Withholding Calculator (Percentage Method)](./art-338-compute-federal-withholding.md)

**Feeds:** _terminal node_
