---
type: DecisionTool
title: "LTC Funding Comparator"
description: "Computes the arithmetic of a declared long-term-care funding comparison over a declared horizon: simple sums of the declared self-fund annual set-aside and the declared traditional annual premium across the declared horizon years, alongside the declared hybrid lump premium, naming the option with the unique smallest total (CHEAPEST_IDENTIFIED) or reporting a tie with no unique cheapest (TIE_IDENTIFIED), with a full trace. Every input is a caller-declared synthetic value; no policy record, health datum, market feed, or clock is read. Rounding is 2dp half-up, declared in-kernel. Discounting at a declared rate and a sensitivity note are out of scope for v1. The kernel never recommends that a caller buy, avoid, or replace any long-term-care funding instrument; it is arithmetic over declarations, not advice."
resource: https://ainumbers.co/tools/686-ltc-funding-comparator.html
tags: ["compliance_control", "wave-117", "mcp:compute_ltc_funding_comparator"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-686-ltc-funding-comparator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/686-ltc-funding-comparator.html
    title: "public tool page"
---

# LTC Funding Comparator

> Exports a decision via MCP `compute_ltc_funding_comparator` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/686-ltc-funding-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-686-ltc-funding-comparator.md) — §10.2.
