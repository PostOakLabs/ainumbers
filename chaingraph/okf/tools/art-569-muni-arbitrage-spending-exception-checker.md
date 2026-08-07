---
type: DecisionTool
title: "Muni Arbitrage Spending-Exception Checker"
description: "Tests whether a tax-exempt bond issue's declared expenditure schedule satisfies one of the three IRC section 148 arbitrage-rebate spending exceptions under Treas. Reg. section 1.148-7: the 6-month exception (100% spent by 6 months, or 95%/12mo with reasonable retainage), the 18-month exception (15%/6mo, 60%/12mo, 100%/18mo, or 95%/18mo plus 100%/30mo with reasonable retainage), or the 24-month construction exception (10%/6mo, 45%/12mo, 75%/18mo, 100%/24mo, or 95%/24mo plus 100%/36mo with reasonable retainage). Whether reasonable retainage is elected is always a caller-declared boolean, never assumed. A caller-declared de minimis amount, capped at the lesser of 3% of gross proceeds or $150,000, may be applied against the required spend at every milestone; an out-of-cap declaration is rejected rather than clamped. Each milestone date is computed calendar-wise from the issue date and receives its own verdict: MET when cumulative spending as of that date reached the required amount, FAILED when the date has passed without reaching it, or PENDING when the milestone date is still in the future relative to the caller-declared evaluation date. Overall exception status is FAILED if any milestone failed, PENDING if none failed but one or more are still pending, and MET only when every milestone has been met. Scope is deliberately narrow: this checks the spending-exception milestone tests only and does not compute the future-value arbitrage rebate itself, which is a separate tool. Clause: IRC section 148; Treas. Reg. section 1.148-7; IRS Pub 5271. Not tax advice."
resource: https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.html
tags: ["compliance_control", "wave-93", "mcp:check_muni_arbitrage_spending_exception"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-569-muni-arbitrage-spending-exception-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.html
    title: "public tool page"
---

# Muni Arbitrage Spending-Exception Checker

> Exports a decision via MCP `check_muni_arbitrage_spending_exception` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-569-muni-arbitrage-spending-exception-checker.md) — §10.2.
