---
type: DecisionTool
title: "NAIC Producer License Reciprocity Check"
description: "Checks NAIC producer license reciprocity for non-resident filing across target states per MDL-218 and NIPR Reciprocity Matrix 2024. Returns all_reciprocal (bool), non_standard_states[] (CA, FL, NJ, NY, HI, MN, WI -- require independent filing), and coverage_by_target[] with per-state reciprocal flag, LOA gaps, and independent-filing notes. State codes and NAIC LOA enum codes only. No National Producer Numbers. Zero PII by construction."
resource: https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.html
tags: ["compliance_mandate", "wave-45", "mcp:check_producer_license_reciprocity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-267-check-producer-license-reciprocity.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.html
    title: "public tool page"
---

# NAIC Producer License Reciprocity Check

> Exports a decision via MCP `check_producer_license_reciprocity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
