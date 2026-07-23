---
type: DecisionTool
title: "NMD Behavioral Repricing Mapper"
description: "OCC 2010-1 Interagency Advisory on IRR: maps non-maturity deposit (NMD) segment balances into a bucketed net-repricing-gap schedule using a caller-declared behavioral allocation (per-bucket repricing fractions) and a deposit beta -- never a baked-in regulatory decay curve. Feeds directly into art-369's repricing_gaps input, which art-369 itself requires as a GIVEN and does not derive. Distinct from art-369 (Rate Shock Ladder Replay), which sweeps shocks over an already-bucketed gap schedule; this kernel builds that schedule from underlying deposit balances. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-442-nmd-behavioral-repricing-mapper.html
tags: ["analytics_mandate", "wave-73", "mcp:map_nmd_behavioral_repricing"]
timestamp: 2026-07-23
---

# NMD Behavioral Repricing Mapper

> Exports a decision via MCP `map_nmd_behavioral_repricing` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-442-nmd-behavioral-repricing-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
