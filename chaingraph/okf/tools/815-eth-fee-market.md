---
type: DecisionTool
title: "Ethereum Base Fee and Blob Base Fee Recompute"
description: "Recomputes the next Ethereum block's base fee per gas (EIP-1559) and its base fee per blob gas (EIP-4844, with the EIP-7918 reserve-price rule from Osaka on) from parent-header values the caller declares. The base-fee section takes the parent gas limit, gas used and base fee and returns the parent gas target, the new base fee, the change in wei and its direction; given the child block's gas limit it also says whether that limit is within the protocol's adjustment bounds. The blob section takes the parent excess blob gas, blob gas used and, on reserve-price forks, the parent base fee, and returns the new excess blob gas, the blob base fee per gas and per blob, the parent's blob base fee under the same schedule, and whether the reserve-price branch fired. Fork parameters (blob target, blob maximum, update fraction, reserve-price switch, elasticity multiplier and change denominator) default to the named fork's published values for Cancun, Prague, Osaka, BPO1 or BPO2 (BPO2 when no fork is named), and any of them can be declared instead; the output says which were used and whether any were overridden. All arithmetic is integer. Recompute from the published formula and your declared parameters; not a prediction of future fees. The node reads no chain, does not cover the London fork-transition block, priority fees or L2 fee models, and checks no header beyond the values supplied."
resource: https://ainumbers.co/chaingraph/815-eth-fee-market.html
tags: ["compliance_control", "wave-142", "mcp:recompute_eth_fee_market"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/815-eth-fee-market.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/815-eth-fee-market.html
    title: "public tool page"
---

# Ethereum Base Fee and Blob Base Fee Recompute

> Exports a decision via MCP `recompute_eth_fee_market` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/815-eth-fee-market.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/815-eth-fee-market.md) — §10.2.
