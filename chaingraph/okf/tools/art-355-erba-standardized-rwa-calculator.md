---
type: DecisionTool
title: "ERBA / Standardized RWA Calculator (Basel Endgame 2026)"
description: "Credit-risk expanded risk-based approach (ERBA) / standardized-approach RWA calculator per the 2026 Basel Endgame reproposal (BCBS/US NPR, reproposed 2026-03-19, comments closed 2026-06-18, final expected ~Q4 2026). Runs an exposure book -- residential real estate by LTV band, retail (QRRE transactor/revolver, other retail), corporate (ECRA external-rating or SCRA unrated), SME support factor, off-balance-sheet CCFs -- through a chosen rule_set (2023 original NPR or 2026 reproposal) and returns per-exposure risk weights, aggregate RWA, and a receipt. rule_status stays proposed until the rule finalizes. Feeds compare_basel_2023_vs_2026 for the versus-2023 capital delta."
resource: https://ainumbers.co/chaingraph/art-355-erba-standardized-rwa-calculator.html
tags: ["capital_assessment", "wave-48", "mcp:compute_rwa_erba_2026"]
timestamp: 2026-07-14
---

# ERBA / Standardized RWA Calculator (Basel Endgame 2026)

> Exports a decision via MCP `compute_rwa_erba_2026` — mandate type `capital_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-355-erba-standardized-rwa-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
