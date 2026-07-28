---
type: DecisionTool
title: "GloBE SBIE & Top-up Tax Calculator"
description: "Computes the OECD Pillar Two substance-based income exclusion (SBIE) for a jurisdiction from a caller-declared payroll-cost figure, tangible-asset carrying value, and a versioned transition-year rate table (payroll % + tangible-asset % looked up by target year, table supplied whole as a policy input -- not hardcoded). Derives excess profit (jurisdictional GloBE income less SBIE, floored at zero), the resulting top-up tax from a caller-supplied top-up-tax percentage, and the final jurisdictional top-up after a QDMTT-paid offset, flagging any QDMTT over-collection informationally. Consumes art-454's jurisdictional GloBE income + top-up-tax-percentage output shape directly and does not recompute an ETR itself, so it also runs standalone. Election choices and GloBE-income adjustments are human judgment and stay upstream. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.html
tags: ["compliance_control", "wave-76", "mcp:compute_globe_sbie_topup"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-455-globe-sbie-topup.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.html
    title: "public tool page"
---

# GloBE SBIE & Top-up Tax Calculator

> Exports a decision via MCP `compute_globe_sbie_topup` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [GloBE Jurisdictional ETR Calculator](./art-454-globe-jurisdictional-etr.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-455-globe-sbie-topup.md) — §10.2.
