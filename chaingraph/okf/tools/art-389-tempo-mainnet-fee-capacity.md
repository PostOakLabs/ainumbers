---
type: DecisionTool
title: "TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator"
description: "Per-tx fee (fee_microusd = ceil(base_fee_attodollars_per_gas x gas_used / 1e12)) and payment-lane TPS headroom for a supplied payment mix, against the published TIP-1010 mainnet constants (base fee 2e10 attodollars/gas, 500M gas/block, ~94% payment-lane reservation). Successor to model_tempo_gas_economics (art-107), which predates these constants. Every parameter is declared with its TIP-1010 citation and carried as protocol_version so a base-fee governance change is a data re-pin, never a code change. Does not read /docs/api/rpc (outside Tempo's stable API contract). Fixed-point BigInt math, calculator only, zero egress."
resource: https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.html
tags: ["treasury_mandate", "wave-65", "mcp:compute_tempo_mainnet_fee_capacity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-389-tempo-mainnet-fee-capacity.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.html
    title: "public tool page"
---

# TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator

> Exports a decision via MCP `compute_tempo_mainnet_fee_capacity` — mandate type `treasury_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
