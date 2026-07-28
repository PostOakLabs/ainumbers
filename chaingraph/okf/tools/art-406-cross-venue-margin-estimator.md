---
type: DecisionTool
title: "Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator"
description: "Estimates the crypto off-exchange settlement / cross-venue margin picture for a book spread across trading venues (the Copper ClearLoop / FalconX / Ceffu model, per AT-CLEARING-WAVE-SPEC.md CW-1): the net cross-venue margin requirement after a declared netting offset against the sum of each venue's own isolated margin, the capital freed and capital efficiency of MPC-custody off-exchange settlement vs on-exchange isolated margin, the financing cost of running the book at a declared leverage multiple checked against a caller-declared program leverage cap (e.g. ClearLoop Loans up to 4x / FalconX up to 5x), and a plain counterparty/custody-risk framing string. Netting percentages, leverage caps and program names are caller-declared, version-pinned fixtures, never fetched or hard-coded. Distinct from the shipped TradFi treasury-clearing cluster (art-48..51), which addresses the US Treasury cash/repo clearing mandate and CME-FICC Combined Portfolio margining -- this node is the crypto prime-brokerage analogue. This receipt attests our computation over the user's declared positions and venue terms -- it does not verify those positions and is not a margin call, a settlement instruction, or investment advice."
resource: https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.html
tags: ["analytics_mandate", "wave-67", "mcp:estimate_cross_venue_margin_capital"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-406-cross-venue-margin-estimator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.html
    title: "public tool page"
---

# Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator

> Exports a decision via MCP `estimate_cross_venue_margin_capital` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-406-cross-venue-margin-estimator.md) — §10.2.
