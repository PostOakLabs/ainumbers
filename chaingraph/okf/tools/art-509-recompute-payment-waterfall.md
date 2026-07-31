---
type: DecisionTool
title: "Securitisation Payment Waterfall Recomputation"
description: "Recomputes a securitisation payment waterfall for one stated period from the aggregate available funds and the priority ladder the investor already holds, then compares the result against what the investor report says was paid. The allocation is derived here by running the ladder, not lifted from the report, so the comparison has independent provenance on both sides rather than re-adding a published column. The ladder, every cap, every trigger threshold and every diversion come from the caller transaction documents: no deal library, no bundled ladder, no market convention threshold and no rate or index table is held here, and the ladder reference the caller pins is carried in the artifact and shown on screen so a later amendment makes an old receipt dated rather than wrong. Steps whose amount is set by a document that is not public, such as a trustee fee or a senior expense governed by a fee letter, are declared asserted by the caller and are reported as asserted inputs rather than as figures this tool derived. A failing test suppresses only the step identifiers the caller declared against that test, so divert behaviour is never inferred from a test name or from convention. Absent any asserted allocations the run is reported as recompute only, which is its own state and never agreement. Money is fixed point in integer minor units throughout with two decimal display, ratio tests are compared by integer cross multiplication so no division occurs on the comparison path, and zero available funds, an empty ladder and a zero ratio denominator each resolve to a defined result rather than to a not a number. No Article 7 disclosure template is read, validated or asserted anywhere, and the arithmetic needs no loan level data. Stated boundary: a shortfall or a difference against the report is an arithmetic finding about the ladder and figures supplied. It forecasts nothing, models no scenario, performs no credit or rating analysis, and makes no assertion that the deal was paid correctly or that it complies with anything."
resource: https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.html
tags: ["analytics_mandate", "wave-78", "mcp:recompute_payment_waterfall"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-509-recompute-payment-waterfall.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.html
    title: "public tool page"
---

# Securitisation Payment Waterfall Recomputation

> Exports a decision via MCP `recompute_payment_waterfall` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Article 5 Due Diligence Evidence Record](./art-510-build-art5-diligence-evidence.md)

## Attested computation

[executor + attester binding](../computations/art-509-recompute-payment-waterfall.md) — §10.2.
