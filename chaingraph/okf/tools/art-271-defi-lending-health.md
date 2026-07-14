---
type: DecisionTool
title: "DeFi Lending Health and Liquidation Monitor"
description: "Computes DeFi lending health factor, liquidation price, borrow capacity, and distance to liquidation for Aave v3, Morpho Blue, Fluid, Sky (MakerDAO v2), and Liquity v2. Handles LTV mode (Aave/Morpho/Fluid) and collateral-ratio mode (Sky/Liquity). Per-protocol liquidation mechanism notes. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-271-defi-lending-health.html
tags: ["analytics_mandate", "wave-46", "mcp:assess_defi_lending"]
timestamp: 2026-07-14
---

# DeFi Lending Health and Liquidation Monitor

> Exports a decision via MCP `assess_defi_lending` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-271-defi-lending-health.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
