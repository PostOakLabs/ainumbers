---
type: DecisionTool
title: "Borrower Escrow Auditor"
description: "Audits a servicer escrow accounting statement from borrower-supplied VALUES ONLY (zero PII by schema): recomputes the aggregate accounting trial running balance month by month from the stated opening balance, stated monthly escrow deposit values, and stated disbursement values, compares the servicer stated end-of-month balances line by line against the recomputation, flags each discrepant statement line with a per-line reason, checks the stated cushion against the one-sixth-of-estimated-total-annual-disbursements cap, and classifies the recomputed account as balanced, shortage, surplus, or deficiency with the corresponding remedy thresholds (50-dollar surplus refund floor conditioned on borrower currency, the courses permitted for a shortage, thresholded on one month's escrow payment). Emits stable scalar evidence fields suitable for anchored-receipt shaping downstream. Declared domain exclusions: no tax-sale scenarios, no escrowed-MSA states, values only -- identifier-like or free-text fields are refused, never echoed, and more than 12 monthly periods is refused."
resource: https://ainumbers.co/chaingraph/732-borrower-escrow-auditor.html
tags: ["consumer_finance", "wave-130", "mcp:audit_borrower_escrow_stmt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/732-borrower-escrow-auditor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/732-borrower-escrow-auditor.html
    title: "public tool page"
---

# Borrower Escrow Auditor

> Exports a decision via MCP `audit_borrower_escrow_stmt` — mandate type `consumer_finance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/732-borrower-escrow-auditor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/732-borrower-escrow-auditor.md) — §10.2.
