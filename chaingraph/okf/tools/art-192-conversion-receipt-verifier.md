---
type: DecisionTool
title: "Conversion Receipt Verifier"
description: "Re-verifies a conversion receipt from art-191: recomputes binding_sha256 over the JCS-canonical receipt and compares, checks structure and hex fields, and optionally compares digests re-hashed from the actual files. Returns a verdict of valid, binding_mismatch, digest_mismatch, or malformed, plus a per-check detail list. This verifies the domain receipt inside the artifact, which is distinct from verify_execution_hash, the utility that verifies the section 4 artifact envelope. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.html
tags: ["cryptographic_mandate", "wave-34", "mcp:verify_conversion_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-192-conversion-receipt-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.html
    title: "public tool page"
---

# Conversion Receipt Verifier

> Exports a decision via MCP `verify_conversion_receipt` — mandate type `cryptographic_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Conversion Receipt Builder](./art-191-conversion-receipt-builder.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-192-conversion-receipt-verifier.md) — §10.2.
