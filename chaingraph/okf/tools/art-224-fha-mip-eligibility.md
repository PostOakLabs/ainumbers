---
type: DecisionTool
title: "FHA MIP Eligibility Calculator"
description: "FHA mortgage insurance premium (MIP) eligibility and cost calculator per HUD Handbook 4000.1. UFMIP: 1.75% of base loan. Annual MIP grid (0.15%-0.75%) by base loan amount vs $726,200 threshold, LTV, and term. MIP duration: 11 years when original LTV at or below 90%; life-of-loan when above 90%. Qualifying ratios: 31% front-end / 43% back-end (compensating factors to 40%/57%). Credit score floors: 580 for 96.5% LTV; 500-579 for 90% max. Table version: HUD-MIP-ML2023-05-ML2024-01 (HUD Mortgagee Letter 2023-05, effective 2023-03-20)."
resource: https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html
tags: ["compliance_mandate", "wave-38", "mcp:compute_fha_mip_eligibility"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-224-fha-mip-eligibility.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html
    title: "public tool page"
---

# FHA MIP Eligibility Calculator

> Exports a decision via MCP `compute_fha_mip_eligibility` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-224-fha-mip-eligibility.md) — §10.2.
