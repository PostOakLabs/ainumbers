---
type: DecisionTool
title: "Reconcile UCP Checkout Totals"
description: "Reconciles a pasted Universal Commerce Protocol (UCP 2026-08-25) cart, checkout or order totals block in integer minor units. Recomputes price x quantity per line (exact base-10 digit-array arithmetic, at most one rounding under the caller-declared policy, default half_even), rolls line subtotals into the document subtotal, checks the breakdown identity and the schema sign rules, and in order mode nets adjustment totals against the refund bound. Returns RECONCILED, MISMATCH or INDETERMINATE with per-finding JSON paths; structurally malformed input refuses the whole call with INPUT_REFUSED. Arithmetic consistency only: it never judges whether a tax, fee or discount amount itself was computed correctly, because UCP publishes no tax or rounding algorithm; Business-extension total types and lines priced on a different basis (item.unit_price) are skipped or reported indeterminate, never guessed. Negative totals are reported informationally (UCP issue #1025) and order discount attribution is reported as not evaluable (issue #1026). Verify-only, zero network calls, no fetched keys. Fixture provenance: derived from the UCP schema and issue material (github.com/Universal-Commerce-Protocol/ucp tag v2026-08-25, commit 7a5daa55313f8b468aba76caf01fb76851d37f84, Apache-2.0), including the repo's flower_shop reference storefront example."
resource: https://ainumbers.co/chaingraph/825-reconcile-ucp-checkout-totals.html
tags: ["compliance_control", "wave-142", "mcp:reconcile_ucp_checkout_totals"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/825-reconcile-ucp-checkout-totals.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/825-reconcile-ucp-checkout-totals.html
    title: "public tool page"
---

# Reconcile UCP Checkout Totals

> Exports a decision via MCP `reconcile_ucp_checkout_totals` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/825-reconcile-ucp-checkout-totals.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/825-reconcile-ucp-checkout-totals.md) — §10.2.
