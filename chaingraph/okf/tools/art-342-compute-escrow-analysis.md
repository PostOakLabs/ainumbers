---
type: DecisionTool
title: "RESPA Aggregate Escrow Analysis"
description: "12 CFR 1024.17 (Reg X) aggregate escrow accounting method: builds a 12-month trial running balance from a starting balance, a monthly escrow deposit, and the projected annual disbursement schedule, compares the low point to the 1/6-of-annual-disbursements cushion target, and classifies the account as balanced, shortage, deficiency, or surplus with the corresponding spread/refund remedy. Not test_hpml_escrow (art-235), which tests whether an escrow account was required to be established in the first place."
resource: https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_escrow_analysis"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-342-compute-escrow-analysis.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.html
    title: "public tool page"
---

# RESPA Aggregate Escrow Analysis

> Exports a decision via MCP `compute_escrow_analysis` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [HPML Definition and Escrow Requirement Test](./art-235-test-hpml-escrow.md)

**Feeds:** _terminal node_
