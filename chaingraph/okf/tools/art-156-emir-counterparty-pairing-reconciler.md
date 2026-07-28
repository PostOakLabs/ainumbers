---
type: DecisionTool
title: "EMIR Counterparty Pairing Reconciler"
description: "Pair two counterparties EMIR Refit reports by UTI and reconcile the caller-supplied matching-field set (up to 148 fields per the 2026 escalation) within a configurable per-field numeric tolerance. Identifies reconciliation breaks so a firm catches the pairing failure before the Trade Repository rejects it. Feeds lifecycle event validator (art-157)."
resource: https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.html
tags: ["compliance_mandate", "wave-28", "mcp:reconcile_emir_pairing"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-156-emir-counterparty-pairing-reconciler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.html
    title: "public tool page"
---

# EMIR Counterparty Pairing Reconciler

> Exports a decision via MCP `reconcile_emir_pairing` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [EMIR Lifecycle Event Validator](./art-157-emir-lifecycle-event-validator.md)

## Attested computation

[executor + attester binding](../computations/art-156-emir-counterparty-pairing-reconciler.md) — §10.2.
