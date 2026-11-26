---
type: DecisionTool
title: "Corridor Cost Averages"
description: "Computes one remittance corridor's cost THREE ways from caller-declared provider quotes and reports each against the SDG 10.c 3% target and the G20 no-corridor-above-5% per-corridor target for 2030. simple = simple average of all quoted total costs (UN SDG indicator 10.c.1 metadata, section 4.c); lowest_n = average of the n cheapest quotes, default n=3 = the SmaRT average defined by the same metadata section; weighted = market-share-weighted average, an analyst convention motivated by the World Bank RPW survey frame (>=80% market-share coverage), reported null with a reason code when shares are missing or do not sum to 100 within tolerance - never silently renormalised. Cost per quote = transfer fee + FX margin as a percentage of the send amount (World Bank RPW methodology; reference amounts 200 and 500, default 200). Integer basis-point arithmetic internally, half-up rounding applied once per figure. Quotes carry pseudonymous provider codes only: no real provider names, no live data, no PII. Malformed quotes refuse the whole call. The simple average output can feed compare_corridor_cost (art-249) as the declared corridor cost."
resource: https://ainumbers.co/chaingraph/787-corridor-cost-averages.html
tags: ["compliance_control", "wave-139", "mcp:compute_corridor_cost_averages"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/787-corridor-cost-averages.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/787-corridor-cost-averages.html
    title: "public tool page"
---

# Corridor Cost Averages

> Exports a decision via MCP `compute_corridor_cost_averages` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/787-corridor-cost-averages.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/787-corridor-cost-averages.md) — §10.2.
