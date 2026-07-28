---
type: DecisionTool
title: "Options Greeks Calculator"
description: "Black-Scholes options pricer with full Greeks (delta, gamma, theta, vega, rho). Equity, FX and rate presets; payoff profile and sensitivity charts. Zero-egress, deterministic."
resource: https://ainumbers.co/chaingraph/qfa-01-options-greeks.html
tags: ["risk_parameter", "wave-3", "mcp:compute_options_greeks"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/qfa-01-options-greeks.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/qfa-01-options-greeks.html
    title: "public tool page"
---

# Options Greeks Calculator

> Exports a decision via MCP `compute_options_greeks` — mandate type `risk_parameter`.

**Context:** FRTB SA greeks — UK PRA PS1/26 Jan 2027; buy-side pre-validation ahead of FRTB-IMA UK Jan 2028

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/qfa-01-options-greeks.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [XVA / CVA Calculator](./qfa-04-xva-cva-calculator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/qfa-01-options-greeks.md) — §10.2.
