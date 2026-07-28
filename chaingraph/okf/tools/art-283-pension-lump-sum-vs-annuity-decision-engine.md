---
type: DecisionTool
title: "Pension Lump-Sum vs. Annuity Decision Engine"
description: "Compares a defined-benefit pension lump-sum offer against the single-life and joint-survivor annuity streams: present value at the stated discount rate with an optional labeled COLA assumption, survivor-option monthly cost, break-even discount rate, and undiscounted break-even age. Terminal node of the retirement-decumulation-decisions chain. Figures are user-supplied off the claimant's own election paperwork, no PII stored. NaN-safe. Zero network."
resource: https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.html
tags: ["compliance_mandate", "wave-50", "mcp:compare_pension_lump_sum_annuity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-283-pension-lump-sum-vs-annuity-decision-engine.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.html
    title: "public tool page"
---

# Pension Lump-Sum vs. Annuity Decision Engine

> Exports a decision via MCP `compare_pension_lump_sum_annuity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Social Security Claiming-Age Optimizer](./art-282-social-security-claiming-optimizer.md)

**Feeds:** _terminal node_
