---
type: DecisionTool
title: "Compute Fund Expense Ratios"
description: "Computes a fund's gross and net expense ratios and Total Expense Ratio (TER) from SUPPLIED gross expense components (flat amounts or accruals, using the identical accrual conventions as recompute_fund_nav/FN-1) and average net assets, applying any declared fee waivers/caps strictly in a DECLARED order using fixed-point BigInt money math throughout (no float accumulation). Waiver ordering is the substance: the order in which fixed-dollar caps, percent-of-remaining reimbursements, and rate caps apply changes the net expense ratio, so the order is a required declared input, never a house convention, and every waiver's running-balance effect is returned for audit. HARD FENCE: every expense component, average-net-assets figure, and waiver term is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never an opinion on expense accuracy and never a compliance determination. Third entry of the Funds/NAV family (nav-verification-pack) alongside recompute_fund_nav (FN-1) and test_nav_error_materiality (FN-2). 40-Act/UCITS citations informative only."
resource: https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.html
tags: ["attestation_mandate", "wave-51", "mcp:compute_fund_expense_ratios"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-375-compute-fund-expense-ratios.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.html
    title: "public tool page"
---

# Compute Fund Expense Ratios

> Exports a decision via MCP `compute_fund_expense_ratios` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; fund expense-ratio computation is a continuous fund-operations control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-375-compute-fund-expense-ratios.md) — §10.2.
