---
type: DecisionTool
title: "SCO60 Group 2 Exposure Limit V2"
description: "Book-level Group 2 exposure-limit assessor for banks' cryptoasset exposures (BCBS d545 Prudential treatment of cryptoasset exposures, SCO60.116-119; the corrected successor to the single-position classifier: the 1% figure is a general-expectation threshold, the must-not-exceed limit is 2% of Tier 1). The caller supplies Tier 1 capital in integer minor units and the Group 2 book as per-cryptoasset positions carrying absolute long and short legs already delta-adjusted for derivatives. Legs are aggregated per cryptoasset and each asset is counted at the higher of its absolute long and short totals, never a netted figure; the per-asset figures sum into one aggregate that is assessed against both thresholds by strict cross-multiplied integer comparisons (exposure*100 against tier1*multiplier), so exactly 1% is not crossed and exactly 2% is not breached, and no floating-point rounding can flip a boundary. Below 1%: no finding. Above 1% and at or below 2%: the expectation threshold is crossed - supervisor notification fires and only the excess over 1% of Tier 1 takes the 1250% Group 2b weight, the remainder keeping its own treatment; this band is not a limit breach and the Pillar 3 precheck is unaffected. Above 2%: the limit is breached - the whole aggregate takes the 1250% weight, the precheck fails, and the breach gap and flags fire. The capital input must be a multiple of 100 minor units so 1% and 2% of it and the excess amount are exact integers; zero, negative, fractional or over-cap capital is a typed refusal, never a NaN or Infinity verdict. The caller owns the completeness of the book (every direct holding - cash and derivatives - and indirect holding - funds, ETF/ETN or similar - must be supplied), the delta adjustment of the legs, and the Tier 1 figure; the node classifies no individual asset and applies no infrastructure-risk add-on, which remain the earlier single-position classifier's decisions. National implementation of the standard varies by jurisdiction and no adoption status is asserted."
resource: https://ainumbers.co/chaingraph/art-711-sco60-crypto-asset-exposure-classifier-v2.html
tags: ["compliance_mandate", "wave-123", "mcp:classify_sco60_exposure_v2"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-711-sco60-crypto-asset-exposure-classifier-v2.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-711-sco60-crypto-asset-exposure-classifier-v2.html
    title: "public tool page"
---

# SCO60 Group 2 Exposure Limit V2

> Exports a decision via MCP `classify_sco60_exposure_v2` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-711-sco60-crypto-asset-exposure-classifier-v2.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-711-sco60-crypto-asset-exposure-classifier-v2.md) — §10.2.
