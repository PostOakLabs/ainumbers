---
type: DecisionTool
title: "Runway Goal Path"
description: "Goal-seek over a fixed monthly startup cash model: the smallest change in price, in month-over-month revenue growth, or in burn that reaches a declared goal, ranked by least effort. The model walks a finite horizon of integer months: revenue starts at the declared base, optionally price-uplifted, and grows at a constant month-over-month rate from month 2; burn is derived once and held constant; cash accumulates net each month, and the first month where cash goes below zero is the cash-out month, interpolated in basis points of a month as (m-1)*10000 + floor(prev_cash*10000/(-net)) with cash landing exactly on zero not counting as a cash-out. Four goal types are declared: a runway of at least N months (the cash-out month in basis points of a month reaches N*10000, or the company stays solvent through the horizon), solvency through the horizon, breakeven (revenue at or above burn) by a month, or ending cash of at least an amount. A grid search walks every combination of the three declared lever grids, keeps the scenarios that meet the goal, and ranks them by effort ascending, where effort is the half-up integer division by 100 of the sum of weight times lever, ties breaking by burn_cut, then price_uplift, then growth_add, all ascending; the all-zero lever scenario is always evaluated and reported as the baseline with baseline_meets_goal. All money is an integer count of minor units and all rates are integer basis points; rounding is half-up, applied once per month step for revenue and once per scenario for burn. Out-of-domain input is refused with a named reason, never rounded or coerced: non-integer or negative money, a growth rate below -10000 basis points, a horizon outside 1-60 months, an unknown goal type, a non-integer goal value, a lever grid unsorted, negative, or holding more than 12 values, non-integer or negative effort weights, or a max_candidates below one. Scope limits: one revenue line, constant burn, no financing events, no churn model, and no tax."
resource: https://ainumbers.co/chaingraph/art-702-runway-goal-path.html
tags: ["compliance_control", "wave-121", "mcp:find_runway_goal_path"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-702-runway-goal-path.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-702-runway-goal-path.html
    title: "public tool page"
---

# Runway Goal Path

> Exports a decision via MCP `find_runway_goal_path` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-702-runway-goal-path.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-702-runway-goal-path.md) — §10.2.
