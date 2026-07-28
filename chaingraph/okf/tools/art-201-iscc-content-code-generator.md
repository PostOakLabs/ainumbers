---
type: DecisionTool
title: "ISCC Content Code Generator"
description: "Generates ISO 24138 ISCC content fingerprints for digital content. Computes Instance-Code (BLAKE3 data integrity), Data-Code (CDC + minhash similarity), optional Meta-Code (simhash over title n-grams from the supplied title), and a composite ISCC-CODE when at least one unit is available. Pure-JS implementation matching the iscc-core conformance vectors. TEXT and METADATA scope only."
resource: https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.html
tags: ["compliance_mandate", "wave-35", "mcp:generate_iscc_code"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-201-iscc-content-code-generator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.html
    title: "public tool page"
---

# ISCC Content Code Generator

> Exports a decision via MCP `generate_iscc_code` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [TDMRep AI Training Reservation Builder](./art-202-tdmrep-reservation-builder.md)

## Attested computation

[executor + attester binding](../computations/art-201-iscc-content-code-generator.md) — §10.2.
