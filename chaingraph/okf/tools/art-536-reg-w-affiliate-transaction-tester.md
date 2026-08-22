---
type: DecisionTool
title: "Reg W Affiliate Transaction Tester"
description: "Tests each caller-declared covered transaction with an affiliate against the Regulation W (12 CFR 223) quantitative limits: the 10% single-affiliate and 20% aggregate-affiliate capital limits, and a collateral-coverage percentage requirement on covered credit transactions. Capital base, both limit percentages, and the collateral-coverage percentage all arrive as caller-declared policy_parameters, cited with a required policy_vintage -- never hardcoded, since 12 CFR 223 figures version on their own schedule. A market-terms flag (the qualitative 12 CFR 223.51 'on terms substantially the same' test) is a caller-declared boolean the node records for the artifact only; it is never a judgment this node makes. Either quantitative limit breached escalates; a collateral shortfall with no capital breach routes to review_required; both limits satisfied and full collateral coverage auto-passes. No policy_parameters or no declared transactions yields a did-not-run execution state rather than a guessed decision. Two further parts of Regulation W sit outside the input space and are not evaluated. First, the exemption inventory: covered-transaction status is caller-declared, and the subpart E exemptions of 12 CFR 223.41 and 223.42, the collateral-requirement exemptions of 223.14(f), and the exclusions of 223.16(c) have no inputs, so a transaction within any of them is still tested against the quantitative limits; the 223.15 prohibition on purchasing a low-quality asset from an affiliate is not evaluated either. Second, the collateral ladder: 223.14(b)(1)(i)-(iv) sets 100, 110, 120, or 130 percent according to collateral class (obligations of the United States or its agencies; obligations of a state or political subdivision; other debt instruments; and stock, leases, or other real or personal property), and collateral class is not an input, so the fact that selects the rung reaches this node already resolved into the caller's collateral-coverage percentage."
resource: https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.html
tags: ["compliance_control", "wave-82", "mcp:test_reg_w_affiliate_transactions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-536-reg-w-affiliate-transaction-tester.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.html
    title: "public tool page"
---

# Reg W Affiliate Transaction Tester

> Exports a decision via MCP `test_reg_w_affiliate_transactions` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-536-reg-w-affiliate-transaction-tester.md) — §10.2.
