---
type: DecisionTool
title: "Bank/AR Confirmation Matcher"
description: "Joins caller-supplied bank and accounts-receivable confirmation responses against caller-supplied ledger balances on (counterparty_id, type), and classifies each pair EXACT_MATCH, TOLERANCE_MATCH, or MISMATCH, plus confirmations with no corresponding ledger balance and ledger balances with no corresponding confirmation. The match tolerance (tolerance_abs, tolerance_pct) is a caller-declared policy input; the explicit, echoed default is 0/0 (exact match required) when the caller declares neither -- there is no silent, unrecorded tolerance. A duplicate (counterparty_id, type) key on either side is reported as a data-quality flag rather than silently overwritten -- only the first occurrence on each side is joined. Third of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-464-confirmation-matcher.html
tags: ["compliance_control", "wave-74", "mcp:match_confirmations"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-464-confirmation-matcher.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-464-confirmation-matcher.html
    title: "public tool page"
---

# Bank/AR Confirmation Matcher

> Exports a decision via MCP `match_confirmations` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-464-confirmation-matcher.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
