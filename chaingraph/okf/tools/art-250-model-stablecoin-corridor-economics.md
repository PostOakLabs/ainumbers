---
type: DecisionTool
title: "Stablecoin Corridor Economics Model"
description: "Models the all-in cost of a USDC-based remittance corridor: on-ramp fee, chain gas fee, off-ramp/local-rail fee, FX spread, and pre-funding float savings vs correspondent banking. Computes gross/net cost in bps and %, savings vs traditional MTO benchmark, and break-even send amount. Rail-agnostic: parameterises the Felix/Circle/Bitso pattern but is NOT tied to a specific protocol. Disambiguates from model_x402_settlement (x402 protocol), model_tempo_payment_economics (Tempo Network), and model_arc_cpn_economics (Arc Protocol CPN). For RPW cross-corridor benchmarking use compare_corridor_cost (art-249). ZERO PII."
resource: https://ainumbers.co/chaingraph/art-250-model-stablecoin-corridor-economics.html
tags: ["analytics_mandate", "wave-42", "mcp:model_stablecoin_corridor_economics"]
timestamp: 2026-07-14
---

# Stablecoin Corridor Economics Model

> Exports a decision via MCP `model_stablecoin_corridor_economics` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-250-model-stablecoin-corridor-economics.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Corridor Cost Comparator (World Bank RPW)](./art-249-compare-corridor-cost.md)
