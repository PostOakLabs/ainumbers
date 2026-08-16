---
type: DecisionTool
title: "Deterministic Amortization Schedule"
description: "Demonstrator node for the shared _amort.bundle.mjs kernel: a deterministic amortization-schedule engine over seven closed day-count conventions (six calendar conventions from ISDA 2006 Definitions Section 4.16 -- 30/360 US, 30E/360, 30E/360 (ISDA), Actual/360, Actual/365 Fixed, Actual/Actual (ISDA) -- plus UNIT_PERIOD for lease/revenue schedules that discount over equal periods rather than calendar day counts). Computes, per period, the effective-interest method's period_fraction, periodic_rate, interest, principal_component and closing_balance, each an independently-declared rounding step, plus a mandatory final-period plug that absorbs rounding residue so the schedule amortizes to exactly zero within a declared bound. Supports a bracketed-bisection rate solve (art-215's discipline, generalized: constant 200-step bound, sign-change bracket required before any rate is reported, no Newton/secant), scoped honestly to UNIT_PERIOD only -- a calendar convention's period_fraction is a real-valued fraction of a year that need not align with the solver's ordinal-integer-period PV formula, so calendar conventions require a caller-supplied annual_rate rather than a mismatched solve. Mid-stream remeasurement is modeled as schedule SEGMENTATION, never mutation: a new segment's opening balance is always the prior segment's exact closing balance, asserted as a continuity_invariant, with the prior segment retained unmodified. No engine transcendentals anywhere (SPEC.md Section 18.5): every exponent is an integer computed by repeated squaring and every rounding step multiplies by a literal power-of-ten, never Math.pow. This is a reusable shared kernel's demonstrator, not itself an ASC 842 / ASC 606 / CECL wave-specific tool -- waves 6, 7 and 10 inline this bundle directly rather than calling this node."
resource: https://ainumbers.co/chaingraph/art-626-deterministic-amortization-schedule.html
tags: ["compliance_mandate", "wave-102", "mcp:compute_deterministic_amortization_schedule"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-626-deterministic-amortization-schedule.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-626-deterministic-amortization-schedule.html
    title: "public tool page"
---

# Deterministic Amortization Schedule

> Exports a decision via MCP `compute_deterministic_amortization_schedule` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-626-deterministic-amortization-schedule.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-626-deterministic-amortization-schedule.md) — §10.2.
