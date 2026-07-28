---
type: DecisionTool
title: "Private-Input NAIC RBC Action Level"
description: "Computes the NAIC Risk-Based Capital action-level tier from a privately held Total Adjusted Capital and Authorized Control Level RBC, emitting only the tier (NO_ACTION through MANDATORY_CONTROL) without disclosing the underlying dollar figures. Carries an OCG Standard §25 ocg-private-input@1 declaration: the capital components are committed via sha256-salted@1 in policy_parameters.rbc_components_commitment, never in the clear. Private-input variant of compute_rbc_action_level (art-254); use that public-input kernel when disclosure of the capital figures is acceptable; use this one when it is not. ZERO PII disclosed: only the action-level tier is public."
resource: https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.html
tags: ["analytics_mandate", "wave-51", "mcp:compute_rbc_action_level_private"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-414-compute-rbc-action-level-private.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.html
    title: "public tool page"
---

# Private-Input NAIC RBC Action Level

> Exports a decision via MCP `compute_rbc_action_level_private` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-414-compute-rbc-action-level-private.md) — §10.2.
