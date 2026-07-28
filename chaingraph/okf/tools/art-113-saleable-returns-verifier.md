---
type: DecisionTool
title: "DSCSA Saleable Returns Verifier"
description: "Match a returned unit SGTIN+lot to its original transaction hash (DSCSA §582(c)(4)(D)). Unauthorized trading partner or mismatched SGTIN/lot → REFUSE. Feeds suspect-product assessment (art-114)."
resource: https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.html
tags: ["compliance_mandate", "wave-22", "mcp:verify_saleable_return"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-113-saleable-returns-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.html
    title: "public tool page"
---

# DSCSA Saleable Returns Verifier

> Exports a decision via MCP `verify_saleable_return` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DSCSA Transaction Statement (T3) Verifier](./art-112-dscsa-transaction-statement-verifier.md)

**Feeds:** [DSCSA Suspect/Illegitimate Product Quarantine Assessor](./art-114-suspect-product-quarantine.md)
