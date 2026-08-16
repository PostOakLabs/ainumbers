---
type: DecisionTool
title: "GloBE Top-Up Tax & QDMTT Allocation Calculator"
description: "OECD Pillar Two GloBE top-up tax calculator: per-jurisdiction substance-based income exclusion (SBIE), effective tax rate (ETR), and top-up-rate/top-up-amount, then allocates the top-up across QDMTT, IIR, and UTPR, applying the OECD Side-by-Side Safe Harbour (approved/declassified 5 January 2026) when the caller declares a Central Record listing of a Qualified SbS Regime, a Filing Constituent Entity election, and a fiscal year on or after 1 January 2026 -- when it applies, Top-up Tax is deemed zero for both the IIR and the UTPR. Ports the calculation from tools/473-globe-etr-jurisdiction-calculator.html and tools/474-topup-tax-qdmtt-calculator.html into one provable kernel. SBIE payroll/asset rates and the 15% minimum rate are OECD-published transitional table values pinned behind a constants_version field -- a rate change is a version bump, never a silent recompute. Jurisdiction-level QDMTT enactment/rate and the Central Record listing are caller-supplied, never vendored."
resource: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html
tags: ["compliance_mandate", "wave-63", "mcp:compute_globe_topup_tax"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-365-compute-globe-topup-tax.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html
    title: "public tool page"
---

# GloBE Top-Up Tax & QDMTT Allocation Calculator

> Exports a decision via MCP `compute_globe_topup_tax` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-365-compute-globe-topup-tax.md) — §10.2.
