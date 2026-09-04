---
type: DecisionTool
title: "Algo Execution Schedule Simulator"
description: "Deterministic execution-schedule arithmetic over caller-declared synthetic inputs. Slices a declared order three ways -- VWAP (across a declared volume_profile_pct that must sum to exactly 100, fail closed otherwise), TWAP (across a declared bucket count with a declared remainder rule for indivisible remainders), and POV (a declared participation rate of declared per-bucket volumes, capped at the remaining order) -- and decomposes implementation shortfall against declared arrival and average-fill prices: shortfall_bps = (avg_fill - arrival) / arrival * 10000 and shortfall_cost = (avg_fill - arrival) * order_shares, sign-corrected by side so positive always reads cost. No market data, no feeds, no network, no clock: every profile, volume, and price is a caller-declared input, never fetched or inferred. This is a simulator of schedule arithmetic, NOT personalized investment advice, NOT a recommendation to trade or to choose any method or schedule, and NOT an order router -- it never sends, stages, or routes any order to any venue. An absent or invalid side, order, method, profile, bucket structure, rate, or price resolves to a fail-closed payload naming each rejected input, never a silently repaired schedule. Settled arithmetic (slicing and shortfall decomposition); it cites no external standard."
resource: https://ainumbers.co/tools/669-algo-execution-schedule-simulator.html
tags: ["analytics_mandate", "wave-113", "mcp:compute_algo_execution_schedule_simulator"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-669-algo-execution-schedule-simulator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/669-algo-execution-schedule-simulator.html
    title: "public tool page"
---

# Algo Execution Schedule Simulator

> Exports a decision via MCP `compute_algo_execution_schedule_simulator` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/669-algo-execution-schedule-simulator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-669-algo-execution-schedule-simulator.md) — §10.2.
