---
type: DecisionTool
title: "Daycount Year Fraction"
description: "Demonstrator node for the shared _daycount.bundle.mjs kernel: prices ONE caller-supplied date pair under ONE declared day-count mode and rolls both dates under the three business-day conventions. Nine closed modes. Seven are the _amort bundle's modes, extracted byte-compatibly (ISDA 2006 Definitions Section 4.16: 30_360_US, 30E_360, 30E_360_ISDA, ACT_360, ACT_365F, ACT_ACT_ISDA, plus the declared UNIT_PERIOD stub mode); two are new ids this bundle adds: ACT_ACT_ICMA (ICMA Rule 251 day count fraction over a caller-declared regular coupon-period schedule and compounding frequency 1, 2, 4 or 12) and BUS_252 (business days between the pair, over a caller-declared calendar, divided by the fixed 252). Every year fraction is returned as an exact gcd-reduced integer rational {num, den} so a caller rounds once after multiplying, plus a declared single-division float convenience value. Business-day rolls follow ISDA 2006 Definitions Section 4.12 (following, modified following, preceding) over caller data: weekend weekday numbers plus holiday dates supplied in policy_parameters and hash-pinned by the caller, never baked into kernel bytes (the _ruleversion single-writer ruling). Every out-of-domain input is a structured named refusal (unknown convention, bad or nonexistent date, inverted pair, missing or over-long schedule, bad frequency, missing calendar, unbounded roll), never a silent default. The bundle was differentially tested against the amortization bundle it was extracted from: 23,216,200 ordered date pairs spanning 1990-2060 with every month end and every Feb 28/29, zero mismatches at the amortization bundle's own declared 10-decimal half-up rounding (calendar modes agree to 1.4e-14 raw; the declared UNIT_PERIOD stub agrees within its declared 1e-9 scale). This node is shared machinery's demonstrator, not itself a wave-specific instrument: consumers inline the bundle directly per the composition contract rather than calling this node."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_control", "wave-135", "mcp:compute_daycount_year_fraction"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-773-daycount-year-fraction.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# Daycount Year Fraction

> Exports a decision via MCP `compute_daycount_year_fraction` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-773-daycount-year-fraction.md) — §10.2.
