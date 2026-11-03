---
type: DecisionTool
title: "TSV Tier-Cap Ladder"
description: "Replays a tokenized-stock venue's (TSV's) daily per-symbol share volume and distinct-symbol counts, aggregated across the TSV and its caller-declared affiliated TSVs, against the SEC TSV Exemption tier caps of FR 2026-19388 (91 FR 60174-76, condition F): Tier 1 is 75 symbols and 0.25 percent of the declared prior-month ADV, Tier 2 is 250 symbols and 2.5 percent; the daily volume cap in integer shares is floor(ADV x 25/10000) or floor(ADV x 250/10000), and a breach is volume strictly greater than the cap. Applies the condition F stepped-compliance ladder to volume breaches only: the first breach in a stock requires no action, every later breach forces an immediate three-month pause in that stock with affiliates included, and the node emits each pause window (breach date to breach date plus three calendar months, month-end clamped) and the notification and public-Notice obligations. Symbol-count breaches get no first-breach pass; the node reports the stated consequence (the TSV would not meet the conditions of the TSV Exemption) and imposes no pause, because the order states none. A stock with no declared prior-month ADV is reported INDETERMINATE, never given an assumed ADV. The order states no reset or look-back window for the ladder, so none is applied and the assumption is carried in the output. Evidence replay only over caller-supplied data: it never looks up LULD tiers or halts and never states or implies that a venue is compliant."
resource: https://ainumbers.co/chaingraph/art-707-tsv-tier-cap-ladder.html
tags: ["compliance_control", "wave-126", "mcp:check_tsv_tier_cap_ladder"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-707-tsv-tier-cap-ladder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-707-tsv-tier-cap-ladder.html
    title: "public tool page"
---

# TSV Tier-Cap Ladder

> Exports a decision via MCP `check_tsv_tier_cap_ladder` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-707-tsv-tier-cap-ladder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-707-tsv-tier-cap-ladder.md) — §10.2.
