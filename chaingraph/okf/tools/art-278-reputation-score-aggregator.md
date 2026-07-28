---
type: DecisionTool
title: "Provable Reputation Score Aggregator"
description: "Aggregates a set of OCG execution receipts (attestations) into a deterministic, groth16-provable reputation score across competence, integrity, timeliness, and cooperation. Exponential decay by age, self-issued attestations excluded, duplicate receipts deduped. Aggregation-math design credit: Vouch Protocol (Apache-2.0, never a runtime dependency); this is a clean-room reimplementation of the aggregation math only."
resource: https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.html
tags: ["attestation_mandate", "wave-49", "mcp:aggregate_reputation_score"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-278-reputation-score-aggregator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.html
    title: "public tool page"
---

# Provable Reputation Score Aggregator

> Exports a decision via MCP `aggregate_reputation_score` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
