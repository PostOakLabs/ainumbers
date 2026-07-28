---
type: DecisionTool
title: "Compute SCRA Rate Cap"
description: "Computes the SCRA 6% interest rate cap per 50 USC §3937 for pre-service loan obligations. Calculates covered months, excess interest, and forgiveness amount. Excess interest is always forgiven (not deferred) per 50 USC §3937(a)(2). Checks servicemember notification requirement. Flags SCRA_RATE_CAP_VIOLATION (original rate > 6%) and SCRA_NOTIFICATION_MISSING. Table: SCRA-50USC3937-2022."
resource: https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.html
tags: ["compliance_mandate", "wave-39", "mcp:compute_scra_rate_cap"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-232-compute-scra-rate-cap.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.html
    title: "public tool page"
---

# Compute SCRA Rate Cap

> Exports a decision via MCP `compute_scra_rate_cap` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Compute MLA MAPR](./art-231-compute-mla-mapr.md)

**Feeds:** _terminal node_
