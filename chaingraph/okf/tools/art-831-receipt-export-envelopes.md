---
type: DecisionTool
title: "Receipt Export Envelopes"
description: "Deterministically re-expresses one caller-supplied execution receipt as two wire envelopes: a lineage RunEvent (eventType COMPLETE, eventTime from the receipt, runId derived as a pure function of the receipt's execution_hash, job namespace/name from the receipt, one input dataset per parent hash named by hash in the estate lineage-card facet dialect) and a structured-mode event envelope (specversion 1.0, id = execution_hash, type co.ainumbers.ocg.receipt.v1, time = the receipt's event time, data echoing the receipt fields unchanged). The receipt is caller-supplied and caller-asserted: the kernel never verifies the hash values, reads no clock, uses no randomness and performs no network access. Fail-closed on any missing or malformed hash, timestamp or URI-reference; a refused export carries no envelopes. Declared domain: one receipt per call, parent hashes and tool ids of equal length. Scope limits: this node does not verify receipt correctness, does not assign timestamps, and is a terminal export view: it consumes nothing and feeds nothing."
resource: https://ainumbers.co/chaingraph/art-831-receipt-export-envelopes.html
tags: ["compliance_control", "wave-142", "mcp:export_receipt_lineage_events"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-831-receipt-export-envelopes.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-831-receipt-export-envelopes.html
    title: "public tool page"
---

# Receipt Export Envelopes

> Exports a decision via MCP `export_receipt_lineage_events` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-831-receipt-export-envelopes.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-831-receipt-export-envelopes.md) — §10.2.
