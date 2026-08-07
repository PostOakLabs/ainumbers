---
type: DecisionTool
title: "Stock-Loan Rebate/Fee Recompute"
description: "Recomputes the periodic rebate or fee bill on an open securities loan that a borrower or beneficial owner receives from an agent lender or prime broker, using the caller's own declared daily collateral and rate data under the standard MSLA/SIFMA Actual/360 daily-accrual convention, then diffs the recomputed total against the statement's claimed amount. Supports both loan bases: rebate-basis loans (cash collateral, daily accrual of collateral value times the benchmark rate minus the rebate spread, with a negative spread-benchmark differential correctly flipping to a borrower-pays amount for a hard-to-borrow security) and fee-basis loans (a flat fee rate on the loaned security's market value, always borrower-pays). Separately checks every declared day's collateral value against the caller-declared SIFMA collateral-maintenance threshold (102% same-currency or 105% cross-currency) independent of whether the period's money total matches. Verdict MATCHES when the computed total agrees with the statement within a caller-declared tolerance and no collateral-mark breach occurred; DIVERGES when either check fails; INDETERMINATE when a required input (the tolerance, the margin percentage, the period, or at least one loan) is absent. The money side complementing the shipped FINRA SLATE reporting tools, which check regulatory transparency reporting rather than the bill itself. Balances are integer minor units and rates are integer basis points, so the arithmetic is exact. Performs arithmetic only over caller-declared daily collateral values, loaned-security market values, and rate/spread inputs; does not source or independently verify any value against a DTC feed, an agent lender's books, or a Reg SHO threshold-security list, and does not determine which collateral-maintenance percentage a given master agreement requires. Clause: SIFMA Master Securities Loan Agreement (MSLA) conventions plus FINRA's Securities Lending and Transparency Engine (SLATE, Rule 6500 Series) as the distinct reporting-side reference."
resource: https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.html
tags: ["compliance_control", "wave-97", "mcp:recompute_stock_loan_rebate_fee"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-579-stock-loan-rebate-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.html
    title: "public tool page"
---

# Stock-Loan Rebate/Fee Recompute

> Exports a decision via MCP `recompute_stock_loan_rebate_fee` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-579-stock-loan-rebate-recompute.md) — §10.2.
