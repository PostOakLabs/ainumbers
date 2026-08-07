---
type: DecisionTool
title: "15c3-3a Note H Margin-Debit Computation"
description: "Recomputes whether a margin debit related to a broker-dealer's customer transactions in U.S. Treasury securities qualifies for inclusion in the Exchange Act Rule 15c3-3 customer or PAB reserve formula under Note H to Exhibit A (Rule 15c3-3a), and if so computes the debit amount. Note H permits that debit only once a registered clearing agency's rules satisfy several Commission-approved conditions and the margin itself comes from a permitted source. This kernel checks each condition as its own declared boolean, cited to the specific Note H subsection it comes from: Commission approval and published notice that Note H is satisfied for the named clearing agency; a separate, gross, per-customer margin calculation; cash margin invested only in short-term U.S. Treasury securities; margin held in a segregated Special Clearing Account at a Federal Reserve Bank or an FDIC-insured bank; and a system for returning excess margin no longer required. The source of the margin is separately checked against Note H's three permitted sources, including the narrow path where a broker-dealer's own Treasury securities may be used only if the customer lacked sufficient margin of its own and the broker-dealer recouped the advance by the next business day. The verdict is INCLUDABLE, NOT_INCLUDABLE, or INDETERMINATE, and INDETERMINATE covers both an unstated condition and missing margin-required or margin-on-deposit figures, neither of which is guessed toward either other verdict. Where INCLUDABLE, the debit is the smaller of the margin required and the margin actually on deposit, since Note H permits a debit no larger than either figure. Money is fixed point in integer minor units throughout with two-decimal display. Cites Exchange Act Rule 15c3-3a Note H by subsection and the SEC's Treasury-clearing compliance dates (cash trades by 2026-12-31, repo by 2027-06-30), each dated for re-verification against primary text. This kernel is a narrow sibling to the shipped art-396 15c3-3 reserve-formula tool: it recomputes only the Note H margin-debit sliver, never the full Items 1-14 reserve formula, and never edits art-396. Not legal or regulatory advice, and whether a clearing agency's rules and Commission notice actually satisfy Note H is for the broker-dealer's own compliance and financial-operations review."
resource: https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.html
tags: ["analytics_mandate", "wave-97", "mcp:compute_note_h_margin_debit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-580-15c3-3a-note-h-margin-debit.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.html
    title: "public tool page"
---

# 15c3-3a Note H Margin-Debit Computation

> Exports a decision via MCP `compute_note_h_margin_debit` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-580-15c3-3a-note-h-margin-debit.md) — §10.2.
