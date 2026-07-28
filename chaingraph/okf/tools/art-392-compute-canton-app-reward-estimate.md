---
type: DecisionTool
title: "Canton App-Reward Estimator (CIP-0104)"
description: "Estimates a Canton Network app provider's Canton Coin reward for one round under CIP-0104 (approved 2026-02-12): app rewards are proportional to confirmed envelope bytes (traffic where the app-provider party appears as confirmer) against that round's app-reward pool share of the minting curve. The pool-share schedule (62% at launch, rising to 69% at year 5, 75% at year 10) is caller-supplied and source-cited, never hard-coded to a single year. Reward side of the ledger -- pairs with compute_canton_traffic_cost (art-391), which computes the fee/cost side of the same synchronizer traffic. Distinct from the shipped tokenization-readiness/DvP/allowlist Canton nodes (503/507/509), which validate settlement and counterparty structure."
resource: https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html
tags: ["analytics_mandate", "wave-64", "mcp:compute_canton_app_reward_estimate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-392-compute-canton-app-reward-estimate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html
    title: "public tool page"
---

# Canton App-Reward Estimator (CIP-0104)

> Exports a decision via MCP `compute_canton_app_reward_estimate` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-392-compute-canton-app-reward-estimate.md) — §10.2.
