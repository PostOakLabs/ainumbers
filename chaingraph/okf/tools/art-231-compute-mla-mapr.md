---
type: DecisionTool
title: "Compute MLA MAPR"
description: "Computes the Military Annual Percentage Rate (MAPR) per 32 CFR §232.4(c) and checks compliance with the 36% cap. MAPR includes all charges excluded from Reg Z APR: credit insurance premiums, debt suspension/cancellation fees, annual membership fees, participation fees, and application fees (credit card only). Bona fide fee exemption: $100/year maximum. Flags MAPR_EXCEEDS_CAP_VIOLATION when MAPR > 36%. DoD MLA rule (32 CFR Part 232), effective October 3, 2016."
resource: https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.html
tags: ["compliance_mandate", "wave-39", "mcp:compute_mla_mapr"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-231-compute-mla-mapr.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.html
    title: "public tool page"
---

# Compute MLA MAPR

> Exports a decision via MCP `compute_mla_mapr` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Compute SCRA Rate Cap](./art-232-compute-scra-rate-cap.md)

## Attested computation

[executor + attester binding](../computations/art-231-compute-mla-mapr.md) — §10.2.
