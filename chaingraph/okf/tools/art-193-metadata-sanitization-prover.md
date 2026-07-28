---
type: DecisionTool
title: "Metadata Sanitization Prover"
description: "Produces a proof-of-sanitization record binding the original digest to the findings removed, redacted, or retained and to the sanitized digest, with a deterministic residual-risk analysis by file type (JPEG COM segments, PNG textual chunks, PDF and DOCX XMP and embedded-object metadata). The kernel receives field names and categories only, never metadata values, because those values can themselves be PII such as GPS coordinates and author names. Returns the sanitization record, residual_risks, and a verdict of sanitized, partially_sanitized, or not_verifiable. Feeds the conversion receipt builder. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.html
tags: ["compliance_mandate", "wave-34", "mcp:prove_metadata_sanitization"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-193-metadata-sanitization-prover.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.html
    title: "public tool page"
---

# Metadata Sanitization Prover

> Exports a decision via MCP `prove_metadata_sanitization` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Conversion Receipt Builder](./art-191-conversion-receipt-builder.md)
