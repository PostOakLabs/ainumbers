---
type: DecisionTool
title: "AI Token Spend"
description: "Monthly AI token spend estimator and cross-model comparator. The caller supplies an as_of date (the node never reads a clock), a usage profile (requests per month, input tokens per request, a cached-input share in basis points, cache-write tokens with a 5-minute or 1-hour TTL, output tokens per request, a batch share and a long-context share), a dated price_table whose entries carry tier, effective_from/effective_through bounds and integer USD micros per million tokens, and the model names to compare. A price entry applies at as_of when effective_from <= as_of <= effective_through; two applicable entries for a compared model are an AMBIGUOUS_PRICE refusal, never a silent pick, and none is NO_PRICE_FOR_DATE. Each component's tokens are split into disjoint plain, batch and long-context slices priced from the matching block; a slice needing a combined batch+long-context block the entry does not list is NO_PRICE_FOR_COMBINATION, and a missing component price is a refusal naming the model and the component. The cost of T tokens at price P is floor(T/1e6)*P + floor((T mod 1e6)*P/1e6), overflow-safe for the validated caps (monthly tokens per component at most 1e12, refused above; prices at most 1e9). Output carries per-model monthly and per-request cost in integer micros, the four-component breakdown, a cheapest-first ranking with ties broken by the model string, per-model refusals, the snapshot age in days, and a scope note: no taxes or regional uplift, no image, audio or video tokens, no tool-use surcharges, no tiered volume discounts, and no subscription or committed-spend deals. Prices are an input, never kernel constants: the default snapshot is a dated capture of the official provider price pages, inlined in the page and manifest, and refreshing it never changes kernel bytes."
resource: https://ainumbers.co/chaingraph/art-704-ai-token-spend.html
tags: ["compliance_control", "wave-122", "mcp:estimate_ai_token_spend"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-704-ai-token-spend.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-704-ai-token-spend.html
    title: "public tool page"
---

# AI Token Spend

> Exports a decision via MCP `estimate_ai_token_spend` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-704-ai-token-spend.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-704-ai-token-spend.md) — §10.2.
