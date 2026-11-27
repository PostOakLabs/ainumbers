---
type: DecisionTool
title: "Ijarah IMBT Rental Schedule"
description: "Computes a month-by-month rental schedule for an ijarah lease that ends with the lessee owning the asset, against one pinned authority profile: the Malaysian regulator's Ijarah policy document, paragraphs 14, 16 and 22. Rental is fixed at inception on a fixed basis, a benchmark basis or a hybrid of the two; a benchmark-determined rental requires a floor and a cap and every benchmark-determined component is clamped into them; a rental revision without a declared mutual agreement is refused as a unilateral increase. Ownership-risk maintenance and takaful cost lines are shown as lessor lines, takaful is required unless a declared conventional-insurance circumstance is supplied with its own cost line, and a schedule with neither is refused. An optional total-loss event models the two branches: with a proven lessee fault the rent continues and restoration sits with the lessee; without it the rent stops from the loss month and takaful proceeds belong to the lessor. Ownership transfer is output as a separate post-lease event by sale at a declared price, conditional hibah, or wa'd to hibah; a wa'd to purchase triggered by anything other than default or breach of terms is refused. Amounts are integer minor units with round-half-even per month. Out of scope in v1: forward ijarah, sub-lease, leaseback, advance or deferred rental timing, and any authority other than the pinned profile, which is refused by name. Outputs are arithmetic and rule checks against the cited text, not a fatwa, Shariah certification, legal opinion or regulatory approval."
resource: https://ainumbers.co/chaingraph/art-856-ijarah-imbt-schedule.html
tags: ["compliance_control", "wave-151", "mcp:compute_ijarah_imbt_schedule"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-856-ijarah-imbt-schedule.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-856-ijarah-imbt-schedule.html
    title: "public tool page"
---

# Ijarah IMBT Rental Schedule

> Exports a decision via MCP `compute_ijarah_imbt_schedule` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-856-ijarah-imbt-schedule.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-856-ijarah-imbt-schedule.md) — §10.2.
