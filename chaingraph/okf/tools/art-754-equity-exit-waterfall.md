---
type: DecisionTool
title: "Equity Exit Waterfall Modeler"
description: "Equity exit proceeds after a liquidation-preference waterfall, ported from ApexLogics Apex #141 (AL-148). From the exit valuation, the aggregate preferred investment, the preferred ownership fraction and liquidation-preference multiple, the participation type (non/full/capped with a cap multiple), and your role, ownership, option strike and cost basis, the node walks the waterfall layer by layer: the preference is min(exit, invested × multiple); non-participating preferred converts to common only when its pro-rata share strictly exceeds the preference (NVCA convention, strict inequality); full participating takes the preference then shares pro-rata; capped participating takes the preference plus pro-rata participation floored at 0 and capped at cap × invested, with the excess reverting to the common pool. Your gross proceeds follow your role (preferred shares in the preferred total; common takes the declared fraction of the common pool), net proceeds are floored at 0 after the option strike, taxable gain is max(0, net − basis) per IRC §1001, and the break-even exit (0 for the preferred role, per Apex) is preference + strike / (common share of common). Non-finite inputs are refused with REFUSED_NON_FINITE_INPUT per the I-JSON guard and a non-positive exit with REFUSED_NON_POSITIVE_EXIT, never a silent guess. The preferred-captured-more-than-common warning is Apex #141's own heuristic, carried flagged (ART754_PREF_WINS_WARNING_HEURISTIC); no official threshold exists for it."
resource: https://ainumbers.co/chaingraph/art-754-equity-exit-waterfall.html
tags: ["consumer_finance", "wave-134", "mcp:calc_equity_exit_waterfall"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-754-equity-exit-waterfall.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-754-equity-exit-waterfall.html
    title: "public tool page"
---

# Equity Exit Waterfall Modeler

> Exports a decision via MCP `calc_equity_exit_waterfall` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-754-equity-exit-waterfall.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-754-equity-exit-waterfall.md) — §10.2.
