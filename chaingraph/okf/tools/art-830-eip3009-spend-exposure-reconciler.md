---
type: DecisionTool
title: "EIP-3009 Spend Exposure Reconciler"
description: "Reconciles a caller-pasted EIP-3009 (ERC-3009, Draft) authorization ledger against caller-pasted AuthorizationUsed and AuthorizationCanceled event rows on a caller-supplied clock, totaling outstanding spend exposure and listing every disagreement with the ledger's own status. Each entry is classified into exactly one class: settled (a used event row matches the identity), canceled (a canceled event row matches), not_yet_valid (no event row matches and the caller clock is at or before the entry's validAfter; excluded from total_outstanding and disclosed beside it), expired_unspent (no event row matches and the strict upper validity bound is at or before the caller clock), outstanding (window open, meaning validAfter is before the clock and the clock is before validBefore, value counted in total_outstanding), or not_evaluated (the identity carries both a used and a canceled row, the clock is absent for a signed entry, or the entry repeats the authorizer, token, chain and nonce of an earlier ledger entry and is flagged DUPLICATE_NONCE_LEDGER, so only the first in canonical order is counted). Event rows match ledger identities by authorizer and nonce, with optional per-row token and chain_id narrowing; an unscoped row spanning more than one token or chain identity is flagged AMBIGUOUS_EVENT_SCOPE and applied to none, a repeated identical row is flagged and applied once, and a row matching no ledger entry is flagged EVENT_WITHOUT_LEDGER_ENTRY. Every applied event row that contradicts the ledger's status claim is itemized under one of four LEDGER_SAYS discrepancy codes. A used and a canceled row on the same identity is EVENT_CONFLICT: the entry is not_evaluated, its value is excluded from the total and disclosed separately in unresolved_conflict_value. An absent event list or absent clock marks that aspect not_evaluated rather than treating it as empty, and total_outstanding is null whenever any signed entry lacks a clock verdict. Arithmetic is integer-only decimal-string uint256 with fixed scan bounds. Zero network calls, no chain reads, no signature recovery: all rows are caller-attested pasted evidence, the cited standard is a Draft, and the output is a reconciliation over pasted records, not a conformance verdict about any token implementation, not an authorization to move funds and not proof that funds moved."
resource: https://ainumbers.co/chaingraph/art-830-eip3009-spend-exposure-reconciler.html
tags: ["compliance_control", "wave-143", "mcp:reconcile_eip3009_spend_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-830-eip3009-spend-exposure-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-830-eip3009-spend-exposure-reconciler.html
    title: "public tool page"
---

# EIP-3009 Spend Exposure Reconciler

> Exports a decision via MCP `reconcile_eip3009_spend_exposure` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-830-eip3009-spend-exposure-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-830-eip3009-spend-exposure-reconciler.md) — §10.2.
