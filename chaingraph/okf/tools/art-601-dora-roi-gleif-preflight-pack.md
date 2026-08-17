---
type: DecisionTool
title: "Dora Roi Gleif Preflight Pack"
description: "DORA RoI GLEIF pre-submission evidence pack, terminal node of chain dora-roi-gleif-preflight-pack (art-466 -> art-599 x N -> art-600 x N -> art-601). Pure composition over upstream node outputs: links to the upstream dora-roi-builder artifact by execution_hash + tool_id (never the raw dataset), and for each LEI-bearing counterparty carries forward its art-599 GLEIF snapshot digest result and its art-600 relationship-consistency result. Rolls up all_snapshots_captured and any_relationship_violation across the counterparty set, plus a named-human attestation closure (management-body role, art-300 pattern). Every element carries captured_at and a source digest so staleness stays visible without the pack asserting freshness. Preparation aid only: assembles evidence a firm compiles when preparing its own DORA RoI submission. Not a submission, not a filing, not a determination that a submission is complete or accurate, and not a statement that any regulator has reviewed or would accept this output. compliance_flags describe pack-assembly state only."
resource: https://ainumbers.co/chaingraph/art-601-dora-roi-gleif-preflight-pack.html
tags: ["compliance_control", "wave-103", "mcp:compute_dora_roi_gleif_preflight_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-601-dora-roi-gleif-preflight-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-601-dora-roi-gleif-preflight-pack.html
    title: "public tool page"
---

# Dora Roi Gleif Preflight Pack

> Exports a decision via MCP `compute_dora_roi_gleif_preflight_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-601-dora-roi-gleif-preflight-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DORA Register of Information (RoI) Builder & Cross-Validator](./art-466-dora-roi-builder.md), [GLEIF Snapshot Digest](./art-599-gleif-snapshot-digest.md), [LEI Relationship Consistency Checker](./art-600-lei-relationship-consistency.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-601-dora-roi-gleif-preflight-pack.md) — §10.2.
