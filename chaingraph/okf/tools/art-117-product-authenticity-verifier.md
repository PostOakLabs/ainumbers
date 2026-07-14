---
type: DecisionTool
title: "Luxury Goods Product Authenticity Verifier"
description: "Verify that presented lineage hashes chain back to the claimed root and that ownership transfers are continuous. Consumer/resale authenticity verdict: terminal stage of digital-product-passport-lineage chain."
resource: https://ainumbers.co/chaingraph/art-117-product-authenticity-verifier.html
tags: ["compliance_mandate", "wave-22", "mcp:verify_product_authenticity"]
timestamp: 2026-07-14
---

# Luxury Goods Product Authenticity Verifier

> Exports a decision via MCP `verify_product_authenticity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-117-product-authenticity-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Digital Product Passport Cradle-to-Gate Lineage Builder](./art-116-product-lineage-builder.md)

**Feeds:** _terminal node_
