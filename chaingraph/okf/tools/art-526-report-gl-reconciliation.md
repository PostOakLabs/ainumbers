---
type: DecisionTool
title: "Report-to-General-Ledger Reconciliation"
description: "Ties a caller-declared reported figure to a caller-declared general-ledger figure, by account -- the only node in this reconciliation programme checked against an independent book of record rather than a second declared value. A designed plug (for example FR 2052a field S.B.6 Carrying Value Adjustment) is a first-class declared input, netted before the residual and never counted as a break. Appendix and supplemental-schedule semantics are versioned policy inputs, never hardcoded. Refuses to run where the requested reporting cadence is finer than the underlying GL schedule's own cadence, and treats a general ledger not yet declared closed as a distinct did_not_run outcome from a genuine tie-out break -- the failure that otherwise surfaces only at quarter-end. Emits a §27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Clause: BCBS 239 §36(c), ECB RDARR Guide §3.5(1)/(2). Not a transaction matcher and not a filing tool."
resource: https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.html
tags: ["attestation_mandate", "wave-82", "mcp:reconcile_report_to_general_ledger"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-526-report-gl-reconciliation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.html
    title: "public tool page"
---

# Report-to-General-Ledger Reconciliation

> Exports a decision via MCP `reconcile_report_to_general_ledger` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-526-report-gl-reconciliation.md) — §10.2.
