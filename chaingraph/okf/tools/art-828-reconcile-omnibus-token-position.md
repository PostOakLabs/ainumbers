---
type: DecisionTool
title: "Omnibus Token Position Reconciliation"
description: "Reconciles a tokenized-securities omnibus token position against caller-declared state: it sums the balances of every declared wallet, computes the omnibus-versus-wallets and omnibus-versus-book-entry deltas, chains a SHA-256 log head over the declared mint, burn, forced-transfer and transfer events in sequence order, counts forced transfers, and returns a RECONCILED / MISMATCH / UNDECIDABLE verdict within a declared integer tolerance. Venue-neutral arithmetic with two profiles: dtc_dts applies the registered-wallet rule from the pinned no-action letter (tokens are only transferable to Registered Wallets, so an unregistered wallet holding a balance is flagged and forces MISMATCH, never dropped from the sum), generic_omnibus runs the same sums without that rule. All inputs are caller-asserted aggregates under opaque labels: integer base units as decimal strings only, floats refused, negative balances refused, identifier-shaped labels (email, LEI, IBAN, long digit runs) refused and never echoed. Honest scope: this proves the arithmetic over the balances you declared. It does not read any ledger, queries nothing, and does not prove the balances are real."
resource: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.html
tags: ["compliance_control", "wave-143", "mcp:reconcile_omnibus_position"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-828-reconcile-omnibus-token-position.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.html
    title: "public tool page"
---

# Omnibus Token Position Reconciliation

> Exports a decision via MCP `reconcile_omnibus_position` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-828-reconcile-omnibus-token-position.md) — §10.2.
