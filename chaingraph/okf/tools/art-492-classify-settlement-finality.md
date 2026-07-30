---
type: DecisionTool
title: "Settlement Finality Classifier"
description: "Vendor-neutral settlement-finality classifier covering three settlement models, each on its own ordered tier ladder: an optimistic challenge window (soft, posted, challengeable, final), a validity proof (soft, committed, proven_unfinalized, final) and single-slot BFT consensus (soft, final). The ladders are deliberately kept separate because a posted batch on an optimistic rollup and a committed batch on a validity rollup are not the same claim, and the ladder actually used is emitted as tier_ladder so the receipt is self-describing. Validity-proof finality is treated as two gates rather than a timer, proof accepted and settlement-layer block finalised, so the in-between position is reported as proven_unfinalized. Adjudicates an asserted finality tier and flags an overstated claim. Chain identity is free text echoed verbatim: there is no chain enum, no named chain profile and no published window table, so the node cannot go stale when a network changes. Evaluation time is caller supplied and the kernel reads no clock. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.html
tags: ["compliance_mandate", "wave-78", "mcp:classify_settlement_finality"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-492-classify-settlement-finality.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.html
    title: "public tool page"
---

# Settlement Finality Classifier

> Exports a decision via MCP `classify_settlement_finality` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-492-classify-settlement-finality.md) — §10.2.
