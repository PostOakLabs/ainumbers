---
type: DecisionTool
title: "HPML Definition and Escrow Requirement Test"
description: "Tests whether a loan qualifies as a Higher-Priced Mortgage Loan (HPML) per Reg Z §1026.35(a)(1): APOR+1.5pp first-lien, APOR+2.5pp jumbo, APOR+3.5pp subordinate (Dodd-Frank structural thresholds, unchanged since 2014). Applies §1026.35(b)(1) escrow requirement for first-lien HPMLs and checks §1026.35(b)(2) exemptions (rural or underserved small creditor, condo master policy). Consumes art-220 (lookup_reg_z_thresholds) for the pinned HPML threshold table. For HOEPA high-cost triggers (APOR+6.5pp/8.5pp): use test_hoepa_high_cost (art-234), not this node."
resource: https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html
tags: ["compliance_mandate", "wave-39", "mcp:test_hpml_escrow"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-235-test-hpml-escrow.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html
    title: "public tool page"
---

# HPML Definition and Escrow Requirement Test

> Exports a decision via MCP `test_hpml_escrow` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Reg Z Threshold Lookup](./art-220-reg-z-threshold-lookup.md)

**Feeds:** _terminal node_
