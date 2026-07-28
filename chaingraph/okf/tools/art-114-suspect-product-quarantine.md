---
type: DecisionTool
title: "DSCSA Suspect/Illegitimate Product Quarantine Assessor"
description: "Determine suspect vs illegitimate product status and required actions (quarantine, investigate, 72-hour FDA Form 3911 notification, trading partner notification). Terminal stage of pharma-serialization-custody chain."
resource: https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.html
tags: ["compliance_mandate", "wave-22", "mcp:assess_suspect_product_status"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-114-suspect-product-quarantine.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.html
    title: "public tool page"
---

# DSCSA Suspect/Illegitimate Product Quarantine Assessor

> Exports a decision via MCP `assess_suspect_product_status` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DSCSA Saleable Returns Verifier](./art-113-saleable-returns-verifier.md)

**Feeds:** _terminal node_
