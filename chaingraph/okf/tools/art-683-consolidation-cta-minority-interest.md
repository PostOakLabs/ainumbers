---
type: DecisionTool
title: "Consolidation with CTA and Minority Interest"
description: "Deterministic foreign-subsidiary consolidation arithmetic over caller-declared synthetic inputs, per the translation method. From a declared subsidiary equity in functional currency, declared current and historical translation rates, and a declared parent ownership percentage, it computes: equity translated at the current rate and at the historical rate (2 decimal places, half-up), the cumulative translation adjustment as the difference between the two translated figures, and the split of translated equity into parent share and minority (non-controlling) interest at the declared ownership, with the parent and minority shares always summing back to translated equity. Overall verdict CONSOLIDATION_COMPUTED on any well-formed input, CONSOLIDATION_REFUSED on the fail-closed path. No subsidiary register, no rate table, no FX feed, no ledger store, no network, no clock: every equity figure, rate, and percentage is a caller-declared input, never fetched or inferred. This is consolidation arithmetic, NOT accounting advice, NOT a determination that any presentation satisfies any reporting framework, NOT a valuation of any subsidiary, and NOT a filing: nothing is posted anywhere. An absent, malformed, or out-of-domain input (non-positive equity or rate, ownership outside 0 to 100 exclusive) resolves to a fail-closed payload naming each rejected input, never a silently repaired consolidation. Rounding is 2 decimal places, half-up, applied in-kernel and stated in the trace; the canonical trace shape is 110000-100000=10000 CTA; split 80/20 of 110000."
resource: https://ainumbers.co/tools/683-consolidation-cta-minority-interest.html
tags: ["compliance_mandate", "wave-114", "mcp:compute_consolidation_cta"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-683-consolidation-cta-minority-interest.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/683-consolidation-cta-minority-interest.html
    title: "public tool page"
---

# Consolidation with CTA and Minority Interest

> Exports a decision via MCP `compute_consolidation_cta` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/683-consolidation-cta-minority-interest.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-683-consolidation-cta-minority-interest.md) — §10.2.
