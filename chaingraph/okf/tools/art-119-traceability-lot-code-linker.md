---
type: DecisionTool
title: "FSMA 204 Traceability Lot Code Chain Linker"
description: "Link Traceability Lot Codes across CTEs and detect chain breaks. Transformation events mint a new TLC (recorded as new_lot_minted). Feeds the recall trace resolver (art-120)."
resource: https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.html
tags: ["compliance_mandate", "wave-22", "mcp:link_traceability_lot_code"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-119-traceability-lot-code-linker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.html
    title: "public tool page"
---

# FSMA 204 Traceability Lot Code Chain Linker

> Exports a decision via MCP `link_traceability_lot_code` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [FSMA 204 Critical Tracking Event (CTE) Validator](./art-118-fsma204-cte-validator.md)

**Feeds:** [FSMA 204 Recall Trace Resolver (24-Hour FDA List)](./art-120-recall-trace-resolver.md)

## Attested computation

[executor + attester binding](../computations/art-119-traceability-lot-code-linker.md) — §10.2.
