---
type: DecisionTool
title: "Event Fee Recompute"
description: "Recomputes event-contract trading fees per fill and per order from an effective-dated venue fee profile, and diffs the recompute against a caller-reported fee (MATCH | OVERCHARGE | UNDERCHARGE). Venue-neutral: the fee family and its parameters are data; closed set parabolic (theta x C x p x (1-p)), multiplier (parabolic x series multiplier), linear, flat, rebate_share (a maker rebate equal to a declared share of the taker-equivalent fee, never a negative theta), combo (legs[]); with shipped effective-dated profile rows for Kalshi (per-fill trade fee ceiled to $0.000001 plus the pinned per-order rounding accumulator, taker theta 0.07 of par, combo maker fees 50% of taker), Polymarket global (pinned category rate table, 5-decimal rounding with the 0.00001 USDC minimum floor) and Polymarket US (taker theta 0.06 from the 2026-07-07 CFTC 40.6(d) letter, 0.0695 from 2026-09-17 per the 2026-09-29 letter, and the pinned combo curve C x p x [0.0695(1-p) + 0.04(1-p)^4] from 2026-09-25), plus a fully caller-declared generic profile whose rows mirror the fields of Kalshi GET /series/fee_changes so a scheduled change is one new row. Multi-outcome markets declare two or more opaque outcome labels. Integer arithmetic only; every fee path is BigInt over integer micro-dollar prices, because theta-numerator x contracts x price x (1e6 - price) products exceed 2^53 for real order sizes; no float appears in any fee path. Conservation is checked on every order: the order fee equals the fill trade fees plus the net carried rounding. Refusals (reachable, fixture-covered): an unknown profile id, a malformed as_of, any order_label or outcome label that looks like an account id, order id, address or hash (identifier-like values are never echoed), malformed order fields, and inputs outside the bounded domain. Scope limits: no account or order identifiers by schema, no live venue data at compute time, no legal verdicts and no trading advice; the node recomputes declared terms and reports arithmetic only; Robinhood, Crypto.com, ForecastEx and Coinbase profiles are deferred (only secondary, conflicting figures exist), and a tiered family is out of scope unless a primary tiered schedule is pinned. Adjacency: art-211 and art-212 compute whole-order fees inside their analyses; this node is the standalone per-fill recompute and edits neither."
resource: https://ainumbers.co/chaingraph/794-event-fee-recompute.html
tags: ["compliance_control", "wave-141", "mcp:recompute_event_contract_fee"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/794-event-fee-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/794-event-fee-recompute.html
    title: "public tool page"
---

# Event Fee Recompute

> Exports a decision via MCP `recompute_event_contract_fee` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/794-event-fee-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/794-event-fee-recompute.md) — §10.2.
