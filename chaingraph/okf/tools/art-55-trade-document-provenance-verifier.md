---
type: DecisionTool
title: "Trade Document Provenance & Consistency Verifier"
description: "Cross-validates a full trade-document set (eBL, commercial invoice, packing list, certificate of origin, insurance certificate) for internal consistency and computes a SHA-256 Merkle provenance root. Flags TBML red flags: over/under-invoicing, phantom shipments, mismatched goods/values (FATF typologies, ICC DSI KTDDE field model). Educational screen, not a SAR determination."
resource: https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html
tags: ["cryptographic_mandate", "wave-12", "mcp:verify_trade_document_set"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-55-trade-document-provenance-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html
    title: "public tool page"
---

# Trade Document Provenance & Consistency Verifier

> Exports a decision via MCP `verify_trade_document_set` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Trade Corridor Fit Diagnostic](./art-52-digital-trade-fit-diagnostic.md), [Digital Trade Rules Compliance Checker](./art-54-digital-trade-rules-checker.md)

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [AMLA Transaction-Typology Risk Scorer](./art-10-amla-transaction-typology-risk-scorer.md), [Time-Series Anomaly Detector](./ml-03-timeseries-anomaly-detector.md)

## Attested computation

[executor + attester binding](../computations/art-55-trade-document-provenance-verifier.md) — §10.2.
