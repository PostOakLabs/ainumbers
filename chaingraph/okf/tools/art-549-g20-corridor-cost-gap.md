---
type: DecisionTool
title: "G20/FSB Corridor Cost-Gap Calculator"
description: "Recomputes a caller-declared cross-border payment corridor's cost gap against the hardcoded G20/FSB roadmap targets: retail cross-border payments end-2027 (no more than 1% global average, no more than 3% any corridor) and remittances 2030 (no more than 3% global average, no more than 5% any corridor). The caller supplies the corridor's observed total-cost percentage (as integer basis points), sourced from World Bank Remittance Prices Worldwide (RPW, methodology Q325) or elsewhere; this kernel never vendors RPW's own corridor cost table, only the published target arithmetic. Zero live FX/rate calls. These are transparency and benchmarking targets, not an enforceable deadline against any single firm -- not a compliance-gate. Not the US Reg E remittance disclosure recompute (see art-reg-e-remittance-disclosure-check for that)."
resource: https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.html
tags: ["risk_parameter", "wave-90", "mcp:check_g20_corridor_cost_gap"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-549-g20-corridor-cost-gap.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.html
    title: "public tool page"
---

# G20/FSB Corridor Cost-Gap Calculator

> Exports a decision via MCP `check_g20_corridor_cost_gap` — mandate type `risk_parameter`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-549-g20-corridor-cost-gap.md) — §10.2.
