---
type: DecisionTool
title: "Ethereum Validator Queue and Sweep Wait"
description: "Computes when one validator's exit, consolidation, activation and withdrawal sweep land, from the Electra consensus specification's balance-based churn rules and the queue state the caller declares. From the total active balance it derives the balance churn limit, the activation and exit churn limit and the consolidation churn limit. Given the declared exit queue head it returns the exit epoch, the churn left in that epoch and the withdrawable epoch; given the consolidation queue head it returns the consolidation epoch; given the pending deposit balance and count ahead, the deposit churn carried over and a declared finality lag, it returns the epoch the deposit is applied, the activation epoch and the wait in epochs; given the sweep position, the target index and the withdrawals ahead of it, it returns the slots until the sweep reaches the target. Every figure is a single closed-form division, with no loop over the queue. Two figures can only be bounded: the activation wait is marked as a lower bound when the deposits ahead are small enough that the 16-deposit limit, not the churn, sets the pace, and the sweep wait is marked as a lower bound whenever withdrawals are ahead of the target. The activation figure assumes no Eth1 bridge backlog and no deposits ahead that belong to exiting validators, and holds the churn at its current value, which moves as stake enters or leaves when it is below its cap. Wall-clock seconds are returned only when the caller declares the slot length. The wait follows from the declared queue state and the published rules. It is not a forecast, reads no chain, and says nothing about any live network."
resource: https://ainumbers.co/chaingraph/812-eth-staking-queue.html
tags: ["compliance_control", "wave-142", "mcp:project_eth_validator_queue_wait"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/812-eth-staking-queue.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/812-eth-staking-queue.html
    title: "public tool page"
---

# Ethereum Validator Queue and Sweep Wait

> Exports a decision via MCP `project_eth_validator_queue_wait` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/812-eth-staking-queue.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/812-eth-staking-queue.md) — §10.2.
