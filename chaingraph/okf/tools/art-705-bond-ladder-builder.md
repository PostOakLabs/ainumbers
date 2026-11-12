---
type: DecisionTool
title: "Bond Ladder Builder"
description: "Builds a target-weight bond ladder from a total notional split across maturity rungs and reports rung-by-rung and portfolio risk analytics: each rung's price, Macaulay and modified duration, DV01 and convexity (the same formulas as compute_bond_duration, compute_dv01 and compute_convexity applied at each rung's notional), plus the target_weight-weighted portfolio aggregates. Every reinvestment assumption is named in plain sentences in the output: hold_to_maturity (cash held at 0%) or roll_to_longest_rung (coupons and maturing principal reinvested at the longest rung's yield), and rung target weights must sum to 1 within 1e-9 or the tool refuses, naming the sum. Exclusions: no credit spread, no call features, flat yield per rung, no live data."
resource: https://ainumbers.co/chaingraph/art-705-bond-ladder-builder.html
tags: ["analytics_mandate", "wave-124", "mcp:build_bond_ladder"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-705-bond-ladder-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-705-bond-ladder-builder.html
    title: "public tool page"
---

# Bond Ladder Builder

> Exports a decision via MCP `build_bond_ladder` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-705-bond-ladder-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-705-bond-ladder-builder.md) — §10.2.
