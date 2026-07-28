---
type: DecisionTool
title: "TRID Fee Tolerance and Cure"
description: "TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Classifies each closing fee into zero-tolerance, ten-percent cumulative, or no-tolerance-limit bucket. Computes 10% bucket aggregate overage, identifies violations, and returns the cure amount required to make the consumer whole under TRID."
resource: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html
tags: ["compliance_mandate", "wave-37", "mcp:compute_trid_tolerance_cure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-216-trid-tolerance-cure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html
    title: "public tool page"
---

# TRID Fee Tolerance and Cure

> Exports a decision via MCP `compute_trid_tolerance_cure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
