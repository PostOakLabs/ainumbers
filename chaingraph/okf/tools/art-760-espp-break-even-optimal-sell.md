---
type: DecisionTool
title: "ESPP Break-Even & Optimal Sell"
description: "ESPP disposition comparator ported from ApexLogics Apex #110 (AL-117). For an ESPP purchase (price paid after the 15% statutory discount, offering-price FMV at grant, current price, shares, grant and purchase dates) and a tax profile (ordinary income, single/MFJ filing, optional as-of date), the node computes the disqualifying and qualifying disposition outcomes side by side: ordinary income (the discount, or its IRC 423(c)-capped qualifying analog), LTCG tax at the 2026 section 1(h) thresholds layered on ordinary income, the marginal ordinary rate from the 2026 section 1 tables, the break-even qualifying-disposition date (later of grant + 2 years + 1 day and purchase + 1 year + 1 day), and after-tax proceeds under each path. Tax constants are Rev. Proc. 2025-32 and IRC 423, fetched and quoted in the payload CITES.md. Out of scope: state tax, AMT, employment-tax treatment, wash-sale rules."
resource: https://ainumbers.co/chaingraph/art-760-espp-break-even-optimal-sell.html
tags: ["compensation_benefits", "wave-134", "mcp:analyze_espp_disposition"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-760-espp-break-even-optimal-sell.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-760-espp-break-even-optimal-sell.html
    title: "public tool page"
---

# ESPP Break-Even & Optimal Sell

> Exports a decision via MCP `analyze_espp_disposition` — mandate type `compensation_benefits`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-760-espp-break-even-optimal-sell.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-760-espp-break-even-optimal-sell.md) — §10.2.
