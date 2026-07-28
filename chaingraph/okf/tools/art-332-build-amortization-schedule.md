---
type: DecisionTool
title: "Amortization Schedule Builder"
description: "Deterministic amortization schedule builder covering level-payment, ARM (index plus margin, periodic and lifetime caps, recast), interest-only, balloon, and temporary buydown (2-1 or 3-2-1) structures, per the unit-period and odd-days conventions in 12 CFR 1026 Appendix J. Returns the full period-by-period schedule (principal, interest, ending balance), totals, a schedule_digest, and advances/payments arrays shaped for direct use as the actuarial APR solver's input. Cents-integer fixed-point math throughout; no floating-point drift."
resource: https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.html
tags: ["compliance_mandate", "wave-59", "mcp:build_amortization_schedule"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-332-build-amortization-schedule.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.html
    title: "public tool page"
---

# Amortization Schedule Builder

> Exports a decision via MCP `build_amortization_schedule` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Reg Z Appendix J APR Solver](./art-215-reg-z-appendix-j-apr.md)
