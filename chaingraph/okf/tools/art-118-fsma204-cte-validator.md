---
type: DecisionTool
title: "FSMA 204 Critical Tracking Event (CTE) Validator"
description: "Validate required Key Data Elements present for each FDA FSMA 204 Critical Tracking Event (harvesting/cooling/initial packing/shipping/receiving/transformation) per the Food Traceability List. Enforcement July 2028."
resource: https://ainumbers.co/chaingraph/art-118-fsma204-cte-validator.html
tags: ["compliance_mandate", "wave-22", "mcp:validate_fsma204_cte"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-118-fsma204-cte-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-118-fsma204-cte-validator.html
    title: "public tool page"
---

# FSMA 204 Critical Tracking Event (CTE) Validator

> Exports a decision via MCP `validate_fsma204_cte` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-118-fsma204-cte-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [FSMA 204 Traceability Lot Code Chain Linker](./art-119-traceability-lot-code-linker.md)
