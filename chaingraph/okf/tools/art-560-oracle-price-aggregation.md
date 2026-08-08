---
type: DecisionTool
title: "Oracle Price Aggregation"
description: "Computes the aggregate price a decentralized oracle network would publish from a set of individual submissions, and gives that print its own citable execution_hash. Four aggregation mechanisms, each named by how it works rather than by any venue that runs it: median-filtered confidence-weighted mean (flag submissions deviating beyond a threshold from the unweighted median, then take the confidence-weighted mean of the survivors), stake-weighted median on the frequency convention (a submitter with twice the weight appears twice as often in the sorted list, never an average pulled toward the heavier weight), three-vote confidence median (each publisher votes price, price+confidence and price-confidence; the aggregate is the median of all votes and the aggregate confidence is the greater distance to the 25th and 75th percentile), and plain median with an f-of-n fault-tolerance readout. Supports an optional prev_print_hash citing the prior print of the same pair, which turns a series of same-pair prints into a walkable chain; omitting it reproduces the unlinked-print output byte for byte. HARD FENCE: every price, weight, confidence, timestamp and submitter id is supplied and asserted, never fetched (zero-egress); this simulates the aggregation step only, does not model the commit-reveal phase that precedes it, and never claims any real network did or would publish this number. A submitter id may be supplied as a sha256-salted commitment under SPEC.md section 25 to withhold the identifier while keeping the aggregation bound to it. Not a price feed and not a market-data source."
resource: https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.html
tags: ["oracle_price_aggregation", "wave-91", "mcp:oracle_price_aggregation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-560-oracle-price-aggregation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.html
    title: "public tool page"
---

# Oracle Price Aggregation

> Exports a decision via MCP `oracle_price_aggregation` — mandate type `oracle_price_aggregation`.

**Context:** No statutory deadline; oracle aggregation is a continuous per-epoch computation, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Currency Basket Index](./art-561-currency-basket-index.md)

## Attested computation

[executor + attester binding](../computations/art-560-oracle-price-aggregation.md) — §10.2.
