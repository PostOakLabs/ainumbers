---
type: DecisionTool
title: "Bank Reconciliation Recompute"
description: "Recomputes a bank-to-book reconciliation and an optional proof of cash from declared values, in integer minor units. The caller declares the statement ending balance, the ledger ending balance, the as-of date, the outstanding deposits and outstanding payments (an id, a positive amount and an item date each), any other reconciling items (an id, a type of bank error, book error, bank fee, interest or other, the side it adjusts, a signed effect and an item date), a stale-item age threshold in days, and optionally a proof of cash with opening, receipts, disbursements and closing for the bank column and the book column. Returns the adjusted bank balance, the adjusted book balance, the unreconciled difference, the items older than the threshold with their age, the per-column proof-of-cash footing difference, whether each closing equals the declared balance, the movement difference, and a verdict of reconciled, unreconciled, indeterminate when a required fact is absent, or input_refused. Limits are 500 items per list and amounts within 1e12 minor units; a value that is present but null, of the wrong type, out of range, duplicated or after the as-of date is refused with a named code and never coerced. Ids and integers only: free-text labels, names and anything shaped like an account number are refused and never read. It recomputes a reconciliation from declared values. It does not read a bank statement and cannot tell whether a declared item is real. It is distinct from art-258, which parses camt.053 statements, art-566, which is an IOLTA three-way reconciliation, and art-499, art-516 and art-526; this node takes a plain bank balance, a book balance and a list of declared items. No adjacency is declared here."
resource: https://ainumbers.co/chaingraph/art-835-bank-reconciliation-recompute.html
tags: ["compliance_control", "wave-149", "mcp:recompute_bank_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-835-bank-reconciliation-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-835-bank-reconciliation-recompute.html
    title: "public tool page"
---

# Bank Reconciliation Recompute

> Exports a decision via MCP `recompute_bank_reconciliation` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-835-bank-reconciliation-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-835-bank-reconciliation-recompute.md) — §10.2.
