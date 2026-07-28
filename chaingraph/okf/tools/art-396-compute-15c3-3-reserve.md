---
type: DecisionTool
title: "15c3-3 Customer Reserve Formula Calculator"
description: "SEC Rule 15c3-3 Exhibit A customer reserve formula: credit items (customer free credit balances, margin credit balances, payables) against allowable debit items (margin-account debits with the 1% collateral haircut, failed-to-deliver debits with the 30-day aging exclusion, other allowable debits) to a reserve requirement, deposit-sufficiency verdict, and line-item receipt. Simplified over a representative subset of Exhibit A line items with a PAB (proprietary-account-of-broker-dealer) variant flag; attests the computation over caller-supplied inputs only, not an audit of those inputs or a determination of regulatory compliance."
resource: https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.html
tags: ["compliance_mandate", "wave-63", "mcp:compute_15c3_3_reserve"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-396-compute-15c3-3-reserve.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.html
    title: "public tool page"
---

# 15c3-3 Customer Reserve Formula Calculator

> Exports a decision via MCP `compute_15c3_3_reserve` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [TRACE / CAT Reporting Lint](./art-397-lint-trace-cat-reports.md)

## Attested computation

[executor + attester binding](../computations/art-396-compute-15c3-3-reserve.md) — §10.2.
