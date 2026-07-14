---
type: DecisionTool
title: "Corridor Cost Comparator (World Bank RPW)"
description: "Benchmarks a remittance corridor total cost (fee % + FX margin %) against the World Bank Remittance Prices Worldwide (RPW) Q1 2026 snapshot for the same origin-destination pair, the SmaRT global average (6.36%), and the SDG 10.c 3% target. Reports meets_sdg_target, vs_rpw_benchmark, cost_at_200_usd, and cost_at_500_usd. For stablecoin corridor all-in economics use model_stablecoin_corridor_economics (art-250). For Reg E disclosure arithmetic use compute_remittance_disclosure (art-248). ZERO PII: corridor codes, amounts, and rates only."
resource: https://ainumbers.co/chaingraph/art-249-compare-corridor-cost.html
tags: ["analytics_mandate", "wave-42", "mcp:compare_corridor_cost"]
timestamp: 2026-07-14
---

# Corridor Cost Comparator (World Bank RPW)

> Exports a decision via MCP `compare_corridor_cost` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-249-compare-corridor-cost.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Remittance Disclosure Calculator (Reg E Subpart B)](./art-248-compute-remittance-disclosure.md), [Stablecoin Corridor Economics Model](./art-250-model-stablecoin-corridor-economics.md)

**Feeds:** _terminal node_
