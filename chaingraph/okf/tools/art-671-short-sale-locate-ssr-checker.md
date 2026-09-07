---
type: DecisionTool
title: "Short-Sale Locate and SSR Checker"
description: "Deterministic locate-documentation and SSR-flag arithmetic over caller-declared synthetic inputs. Classifies a declared short-sale order against declared locate documentation (declared source, list date, on-list flag) and carries the caller-declared short-sale price restriction (SSR) flag verbatim: locate_satisfied follows the declared on-list flag, ssr_restriction is a pass-through of the declared flag (the price test itself belongs to the caller's feeds), and overall resolves to LOCATE_MISSING, SSR_RESTRICTED, or LOCATE_DOCUMENTED. Pairs with T372 (buy-in scope classifier) when no locate is documented. No borrow lists, no SSR tapes, no cutoff feeds, no registers, no network, no clock: every order, locate fact, and flag is a caller-declared input, never fetched or inferred. This is a checker of declared-input arithmetic, NOT compliance advice, NOT a recommendation to borrow, locate, cover, or trade, and NOT connected to any live feed or register -- a declared on-list flag is documentation the caller asserts, never a fact this kernel verified; the not_proven discipline applies. An absent or invalid order, locate, or flag resolves to a fail-closed payload naming each rejected input, never a silently repaired classification. Settled classification arithmetic; it cites no external standard."
resource: https://ainumbers.co/tools/671-short-sale-locate-ssr-checker.html
tags: ["compliance_mandate", "wave-114", "mcp:compute_short_sale_locate_ssr_checker"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-671-short-sale-locate-ssr-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/671-short-sale-locate-ssr-checker.html
    title: "public tool page"
---

# Short-Sale Locate and SSR Checker

> Exports a decision via MCP `compute_short_sale_locate_ssr_checker` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/671-short-sale-locate-ssr-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-671-short-sale-locate-ssr-checker.md) — §10.2.
