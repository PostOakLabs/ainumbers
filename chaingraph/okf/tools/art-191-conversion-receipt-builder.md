---
type: DecisionTool
title: "Conversion Receipt Builder"
description: "Binds one file-conversion event into a canonical receipt tying the input digest to the converter identity, the parameters, and the output digest. binding_sha256 is SHA-256 over the JCS-canonical receipt with binding_sha256 removed. Any external converter, including the heavy WASM Conversion Lab tools, can feed it digests, and it is the documented hand-off point for BrowserChain anchoring. This binds a transformation edge between two digests, which is a different job from anchor_document_integrity (art-121, existence and timestamp of one document). Returns the receipt plus checks for hex validity, converter identity completeness, and self-conversion. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.html
tags: ["cryptographic_mandate", "wave-34", "mcp:build_conversion_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-191-conversion-receipt-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.html
    title: "public tool page"
---

# Conversion Receipt Builder

> Exports a decision via MCP `build_conversion_receipt` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Conversion Receipt Verifier](./art-192-conversion-receipt-verifier.md)

## Attested computation

[executor + attester binding](../computations/art-191-conversion-receipt-builder.md) — §10.2.
