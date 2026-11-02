---
type: DecisionTool
title: "Modified Premium Calculator"
description: "Workers'-compensation modified premium: subject premium (total manual premium plus premium items subject to experience rating) times the experience modification, rounded to whole dollars per the pinned Whole Dollars - Premiums rule. Subject premium composition is the caller's responsibility -- this node does not compute manual premium from payrolls and rates and never vendors or reproduces NCCI or state rate tables. Out of scope: premium discount, expense constant, terrorism/catastrophe surcharges, state taxes, schedule rating and assigned-risk surcharge; the NCCI formula does not apply in the monopolistic state funds (Ohio, North Dakota, Washington, Wyoming) or the Puerto Rico and USVI funds. A mod of 0 or less flags and never yields a premium."
resource: https://ainumbers.co/chaingraph/art-782-modified-premium.html
tags: ["compliance_mandate", "wave-141", "mcp:compute_modified_premium"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-782-modified-premium.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-782-modified-premium.html
    title: "public tool page"
---

# Modified Premium Calculator

> Exports a decision via MCP `compute_modified_premium` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-782-modified-premium.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NCCI Experience Modification Calculator](./art-346-compute-experience-mod.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-782-modified-premium.md) — §10.2.
