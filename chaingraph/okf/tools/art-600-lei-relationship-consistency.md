---
type: DecisionTool
title: "LEI Relationship Consistency Checker"
description: "Checks four structural invariants over a pasted set of GLEIF Level-2 relationship records for one subject LEI: every startNode and endNode is a syntactically valid LEI (ISO 17442 mod-97, the same check art-246 carries), walking IS_DIRECTLY_CONSOLIDATED_BY edges never revisits a node already on the current path, every reporting-exception code is a published GLEIF category held as a versioned constant rather than inferred, and no two active records share a startNode, endNode and relationshipType triple with overlapping validity periods. A violation flags a possible inconsistency in GLEIF's published Level-2 data for this LEI. It is not an assertion about the entity's actual corporate structure and not a finding about the entity itself; golden-copy data is periodically corrected, so recheck against a fresh pull before treating any violation as durable. An empty record set returns consistent as null rather than a clean pass. Zero network: this never queries GLEIF and is not a re-implementation of GLEIF's own reconciliation service."
resource: https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.html
tags: ["compliance_control", "wave-99", "mcp:check_lei_relationship_consistency"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-600-lei-relationship-consistency.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.html
    title: "public tool page"
---

# LEI Relationship Consistency Checker

> Exports a decision via MCP `check_lei_relationship_consistency` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-600-lei-relationship-consistency.md) — §10.2.
