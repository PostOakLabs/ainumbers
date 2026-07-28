---
type: DecisionTool
title: "LCM Rate Derivation Calculator"
description: "Computes the Loss Cost Multiplier (LCM) and indicated insurance rate from user-supplied loss costs and expense/profit loadings. LCM = 1 / (1 - LAE% - fixed_exp% - variable_exp% - profit%). Indicated rate = loss_cost * LCM. Supports credibility-weighted blending of user's own loss costs with a complement. PROPRIETARY-DATA: this kernel performs LCM decomposition arithmetic ONLY on user-supplied loss costs -- it NEVER embeds, redistributes, or references ISO/Verisk advisory loss cost rate pages (Verisk-proprietary). ASOP 25 compliant. ZERO PII: aggregate rate components only."
resource: https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html
tags: ["analytics_mandate", "wave-43", "mcp:compute_lcm_rate_derivation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-255-compute-lcm-rate-derivation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html
    title: "public tool page"
---

# LCM Rate Derivation Calculator

> Exports a decision via MCP `compute_lcm_rate_derivation` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
