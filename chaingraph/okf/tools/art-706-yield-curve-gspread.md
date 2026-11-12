---
type: DecisionTool
title: "Yield Curve & G-Spread"
description: "Builds a par yield curve from caller-supplied benchmark points (at least 2, strictly increasing tenors; no live data, the caller's points are used exactly as given) under a named, versioned interpolation, linear (linear@1) or monotone cubic Hermite with Fritsch-Carlson 1980 tangents (monotone_cubic_hermite@1), and reports the G-spread of a bond against that curve: the interpolated benchmark yield at the bond's maturity and (bond yield minus benchmark yield) x 100 in basis points. A bond maturity outside the benchmark tenor range is refused naming the range, never extrapolated. Every assumption is named in plain sentences in the output. Exclusions: no bootstrapping of zero rates, no day-count, no live Treasury feed."
resource: https://ainumbers.co/chaingraph/art-706-yield-curve-gspread.html
tags: ["analytics_mandate", "wave-125", "mcp:build_yield_curve_gspread"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-706-yield-curve-gspread.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-706-yield-curve-gspread.html
    title: "public tool page"
---

# Yield Curve & G-Spread

> Exports a decision via MCP `build_yield_curve_gspread` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-706-yield-curve-gspread.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-706-yield-curve-gspread.md) — §10.2.
