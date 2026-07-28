---
type: DecisionTool
title: "Commission Hierarchy Validator"
description: "BFS structural validation of multi-level sales commission hierarchies. Detects orphan agents (unreachable from root), circular references (cycle in parent chain), split-sum violations (direct-report allocations exceeding 100% of parent), and max-depth-exceeded flag. Returns is_valid (bool), violations[], and structural metrics. Accepts agent_id, parent_id, split_pct arrays. No National Producer Numbers, SSNs, or TINs. Zero PII by construction."
resource: https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.html
tags: ["compliance_mandate", "wave-45", "mcp:validate_commission_hierarchy"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-264-validate-commission-hierarchy.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.html
    title: "public tool page"
---

# Commission Hierarchy Validator

> Exports a decision via MCP `validate_commission_hierarchy` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Commission Statement Reconciler](./art-266-reconcile-commission-statement.md)
