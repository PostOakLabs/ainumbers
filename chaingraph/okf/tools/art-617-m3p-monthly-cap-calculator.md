---
type: DecisionTool
title: "M3P Monthly Cap Calculator"
description: "Recomputes the Medicare Prescription Payment Plan (M3P) maximum monthly cap under 42 CFR 423.137(c)(1)(i) (first month of participation) and (c)(1)(ii) (every subsequent month), verified by exhaustive enumeration over the full declared cents/months domain (4,830,023 states). The annual out-of-pocket threshold is a plan-year-indexed CMS figure, carried as a keyed, source-digested policy parameter rather than a bare constant -- CY2026 is $2,100. Rounding is declared half-up-to-the-cent, since the regulation states no explicit rounding rule for the division step; the declaration is backed by three independent CMS-sourced worked examples and implemented with exact integer arithmetic, never floating-point division. A caller-declared numerator or months value outside the declared domain is rejected with a named reason, never clamped or silently coerced. Verify-only: recomputes the formula from caller-declared inputs, does not track a real enrollee's true out-of-pocket accumulation, does not enroll anyone in M3P, and does not assert that any actual participant's bill is correct."
resource: https://ainumbers.co/tools/617-m3p-monthly-cap-calculator.html
tags: ["payment_policy", "wave-102", "mcp:compute_m3p_monthly_cap"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-617-m3p-monthly-cap-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/617-m3p-monthly-cap-calculator.html
    title: "public tool page"
---

# M3P Monthly Cap Calculator

> Exports a decision via MCP `compute_m3p_monthly_cap` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/617-m3p-monthly-cap-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-617-m3p-monthly-cap-calculator.md) — §10.2.
