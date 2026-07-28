---
type: DecisionTool
title: "Embedded Insurance Pricing Modeller"
description: "Embedded-insurance unit economics for a platform attaching per-transaction coverage: per-transaction premium, monthly/annual gross written premium, net written premium after reinsurance cession, expected losses, commission and opex cost, underwriting profit, combined ratio, expense ratio, and breakeven loss ratio. Ports the calculation from tools/446-embedded-insurance-pricing-modeller.html into a provable kernel. Losses apply against net written premium while commission and opex apply against gross written premium -- the source tool's own simplification, ported as-is."
resource: https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.html
tags: ["analytics_mandate", "wave-63", "mcp:price_embedded_insurance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-366-price-embedded-insurance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.html
    title: "public tool page"
---

# Embedded Insurance Pricing Modeller

> Exports a decision via MCP `price_embedded_insurance` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
