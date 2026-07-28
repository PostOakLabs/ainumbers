---
type: DecisionTool
title: "HOEPA High-Cost Mortgage Trigger Test"
description: "Tests all three HOEPA high-cost mortgage triggers per Reg Z §1026.32(a)(1): (i) APR trigger (APOR+6.5pp first-lien, APOR+8.5pp subordinate or dwelling below $50k); (ii) points-and-fees trigger (5% of loan or $1,380 floor, 2026, FR 2025-22773); (iii) prepayment penalty trigger (>36 months or >2% of prepaid amount). Outputs is_high_cost plus which triggers fired. Consumes art-220 (lookup_reg_z_thresholds) for the pinned HOEPA threshold table. Use test_hpml_escrow (art-235) for HPML escrow, not HOEPA. Use check_qm_points_and_fees (art-218) for the QM points-and-fees ability-to-repay test."
resource: https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.html
tags: ["compliance_mandate", "wave-39", "mcp:test_hoepa_high_cost"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-234-test-hoepa-high-cost.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.html
    title: "public tool page"
---

# HOEPA High-Cost Mortgage Trigger Test

> Exports a decision via MCP `test_hoepa_high_cost` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Reg Z Threshold Lookup](./art-220-reg-z-threshold-lookup.md)

**Feeds:** _terminal node_
