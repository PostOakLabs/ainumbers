---
type: DecisionTool
title: "Rate Shock Ladder Replay"
description: "US OCC/FDIC interest-rate-risk parallel shock ladder: sweeps four prescribed parallel magnitudes (+/-100/200/300/400bp) over a bucketed repricing-gap schedule, returning both a duration-weighted delta-EVE leg and a 12-month cumulative-gap delta-NII leg per shock. Optional non-parallel steepener/flattener presets are caller-declared (short/long tenor bps split), not baked-in regulatory scalars. Distinct from the shipped BCBS d368 / EBA standardised six-scenario convention (art-183/art-185): sweeps multiple magnitudes rather than one, and combines EVE+NII in a single kernel. Complements CC-A repricing-gap schedules or user-supplied gap tables. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.html
tags: ["analytics_mandate", "wave-64", "mcp:run_rate_shock_ladder"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-369-run-rate-shock-ladder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.html
    title: "public tool page"
---

# Rate Shock Ladder Replay

> Exports a decision via MCP `run_rate_shock_ladder` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-369-run-rate-shock-ladder.md) — §10.2.
