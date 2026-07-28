---
type: DecisionTool
title: "QM Points and Fees Test"
description: "Qualified Mortgage points-and-fees test per Reg Z §1026.43(e)(3). Applies version-pinned 2021-2026 tier table with Federal Register citations. Covers five tiers: 3% for loans over tier-1 minimum, fixed dollar amounts for mid-range loans, 5% and 8% for smaller loans. Agents hallucinate current-year thresholds; this node supplies authoritative version-pinned values."
resource: https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.html
tags: ["compliance_mandate", "wave-37", "mcp:check_qm_points_and_fees"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-218-qm-points-and-fees.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.html
    title: "public tool page"
---

# QM Points and Fees Test

> Exports a decision via MCP `check_qm_points_and_fees` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [QM APR-APOR Spread Classifier](./art-219-qm-apr-apor-spread.md)
