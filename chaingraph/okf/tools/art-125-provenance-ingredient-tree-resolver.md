---
type: DecisionTool
title: "Provenance Ingredient Tree Resolver"
description: "Walk the c2pa.ingredient parent-of tree; confirm each ingredient hashed_uri binding and nested manifest hash chains back to the active manifest; flag broken provenance edges and redacted-but-referenced ingredients. Emits tree depth and intact/broken verdict."
resource: https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.html
tags: ["compliance_mandate", "wave-23", "mcp:resolve_provenance_ingredient_tree"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-125-provenance-ingredient-tree-resolver.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.html
    title: "public tool page"
---

# Provenance Ingredient Tree Resolver

> Exports a decision via MCP `resolve_provenance_ingredient_tree` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Content Credential Signature Verifier](./art-124-content-credential-signature-verifier.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-125-provenance-ingredient-tree-resolver.md) — §10.2.
