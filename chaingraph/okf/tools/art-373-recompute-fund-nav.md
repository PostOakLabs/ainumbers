---
type: DecisionTool
title: "Recompute Fund NAV"
description: "Recomputes a fund's net-asset-value-per-share from SUPPLIED holdings (quantity x supplied price, multi-currency with supplied FX), accruals (income and expense with a declared day-count convention), liabilities, and shares outstanding, using fixed-point BigInt money math throughout (no float accumulation). Applies a declared rounding mode (e.g. $0.0001 for a money-market fund vs $0.01 for a standard fund) and returns a full component breakdown. HARD FENCE: every price and FX rate is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never a fair-value opinion, never an independent valuation, never live market data. First entry of the Funds/NAV family (nav-verification-pack) alongside test_nav_error_materiality (FN-2) and compute_fund_expense_ratios (FN-3). Not fund_share_class_composer (asset allocation) or any pricing/valuation tool. 40-Act/UCITS citations informative only."
resource: https://ainumbers.co/chaingraph/art-373-recompute-fund-nav.html
tags: ["attestation_mandate", "wave-51", "mcp:recompute_fund_nav"]
timestamp: 2026-07-14
---

# Recompute Fund NAV

> Exports a decision via MCP `recompute_fund_nav` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; NAV recomputation is a continuous fund-operations control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-373-recompute-fund-nav.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
