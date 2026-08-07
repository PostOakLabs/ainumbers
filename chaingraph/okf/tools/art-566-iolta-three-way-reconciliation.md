---
type: DecisionTool
title: "IOLTA Three-Way Trust Reconciliation"
description: "Recomputes the monthly IOLTA/client-trust three-way close every small law firm already does by hand in a spreadsheet: the bank statement (adjusted for caller-declared deposits in transit and uncleared checks) against the trust ledger total against the sum of every per-client ledger balance, all as of the same statement period end. Separately walks each client's declared period activity to catch a client ledger that dips negative at any point during the period even when its ending balance looks fine: the classic commingling fact pattern where one client's disbursement is briefly funded by another client's money before a later deposit covers it. Ages every declared outstanding item from the period end so a check or deposit that has sat unresolved for months is visible rather than buried inside a balancing adjustment, and checks that every input balance is stated as of the same period-end date. Reconciliation tolerance is always a declared input, never defaulted; a negative client-ledger low point is never tolerance-gated. Verdict RECONCILED when the three-way equality holds, no client ledger went negative, no outstanding item is stale, and every date lines up; DISCREPANT when any of those breaks; INCOMPLETE when a required input (the tolerance, the period, a balance, or at least one client ledger) is absent. Balances are integer minor units, so the arithmetic is exact. Performs arithmetic only over caller-declared balances and caller-declared outstanding items; does not source, derive, or independently verify any balance, and does not itself determine which bank lines are outstanding. Clause: ABA Model Rule 1.15 (Safekeeping Property); state record-keeping rules govern the specifics and are cited in-page as dated illustrations only, never as a 50-state table."
resource: https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.html
tags: ["compliance_control", "wave-93", "mcp:check_iolta_three_way_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-566-iolta-three-way-reconciliation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.html
    title: "public tool page"
---

# IOLTA Three-Way Trust Reconciliation

> Exports a decision via MCP `check_iolta_three_way_reconciliation` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-566-iolta-three-way-reconciliation.md) — §10.2.
