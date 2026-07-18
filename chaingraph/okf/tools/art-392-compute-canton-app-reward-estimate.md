---
type: DecisionTool
title: "Canton App-Reward Estimator (CIP-0104)"
description: "Estimates a Canton Network app provider's Canton Coin reward for one round under CIP-0104 (approved 2026-02-12): app rewards proportional to confirmed envelope bytes against that round's app-reward pool share of the minting curve. The pool-share schedule (62% at launch, 69% at year 5, 75% at year 10) is caller-supplied and source-cited, never hard-coded to a single year."
resource: https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html
tags: ["analytics_mandate", "wave-64", "mcp:compute_canton_app_reward_estimate"]
timestamp: 2026-07-18
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
