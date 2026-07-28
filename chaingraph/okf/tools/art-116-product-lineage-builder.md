---
type: DecisionTool
title: "Digital Product Passport Cradle-to-Gate Lineage Builder"
description: "Build a cradle-to-gate supplier lineage with hash-only claims per stage (no trade secrets). Each stage carries a supplier_hash anchor, dataVersion-pinned certification, and carbon_value. Aggregates total carbon deterministically."
resource: https://ainumbers.co/chaingraph/art-116-product-lineage-builder.html
tags: ["compliance_mandate", "wave-22", "mcp:build_product_lineage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-116-product-lineage-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-116-product-lineage-builder.html
    title: "public tool page"
---

# Digital Product Passport Cradle-to-Gate Lineage Builder

> Exports a decision via MCP `build_product_lineage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-116-product-lineage-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU ESPR Digital Product Passport Data Carrier Validator](./art-115-dpp-data-carrier-validator.md)

**Feeds:** [Luxury Goods Product Authenticity Verifier](./art-117-product-authenticity-verifier.md)
