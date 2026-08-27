---
type: DecisionTool
title: "Derivatives Margin Workbench"
description: "Computes three related derivatives calculations from one declared position: event-market linear PnL (settlement vs strike, scalar payoff), margin health (unrealized PnL, buffer, liquidation price, leverage) against a caller-declared venue margin model (regulated-DCM or offshore-perp class, with its own initial/maintenance margin rates rather than an internal per-venue lookup table), and, when a second position is supplied, two-leg correlation-VaR cross-margin efficiency (siloed vs shared capital requirement). Scope: closed-form pedagogical approximations of the same computations live risk engines run, not a stress-grid or SPAN-style margin system, and not financial advice."
resource: https://ainumbers.co/tools/656-derivatives-margin-workbench.html
tags: ["derivatives_margin_health", "wave-111", "mcp:compute_derivatives_margin_workbench"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-656-derivatives-margin-workbench.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/656-derivatives-margin-workbench.html
    title: "public tool page"
---

# Derivatives Margin Workbench

> Exports a decision via MCP `compute_derivatives_margin_workbench` — mandate type `derivatives_margin_health`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/656-derivatives-margin-workbench.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-656-derivatives-margin-workbench.md) — §10.2.
