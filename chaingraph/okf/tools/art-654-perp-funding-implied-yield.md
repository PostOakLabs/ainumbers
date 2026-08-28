---
type: DecisionTool
title: "Perp Funding Implied Yield"
description: "Recomputes a perpetual-contract funding rate and its simple-annualized implied yield from caller-declared inputs, for either of two declared funding-mechanism variants: offshore-8h-twap (a continuous TWAP-sampled premium-index-plus-interest-rate-differential-clamp formula, the shape observed on offshore crypto perpetual venues) or kalshi-periodic (a simpler point-in-time price-differential reset, modeled against the CFTC's 2026 regulated-perpetual-contract framework). The funding mechanism, and every numeric parameter of it (interval length, clamp bound), is always a declared input, never an assumed default. An optional prev_funding_hash chains this print to its predecessor's own execution_hash, turning a series of same-pair prints into a walkable, cryptographically bound funding history. Complements the landed Prediction Market Artifact Validator (T631) in copy only, with no file overlap: that tool validates settlement artifacts for event markets, this one recomputes the ongoing funding-rate carry on a perpetual position. Verify-only: recomputes a caller-declared formula from caller-declared inputs, never fetches a live market price or a venue's actual current funding print, and never asserts that any venue's own published print matches this recompute. A declared input outside the domain (invalid mechanism, non-positive price, malformed prior-print hash, etc.) is rejected by name, never silently clamped or coerced."
resource: https://ainumbers.co/chaingraph/art-654-perp-funding-implied-yield.html
tags: ["perp_funding_rate", "wave-111", "mcp:compute_perp_funding_implied_yield"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-654-perp-funding-implied-yield.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-654-perp-funding-implied-yield.html
    title: "public tool page"
---

# Perp Funding Implied Yield

> Exports a decision via MCP `compute_perp_funding_implied_yield` — mandate type `perp_funding_rate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-654-perp-funding-implied-yield.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-654-perp-funding-implied-yield.md) — §10.2.
