---
type: DecisionTool
title: "Evidence Bundle Tier Labeler"
description: "Assembles a shareable evidence bundle around an artifact and stamps the SPEC.md §SIDECAR.1 tiered label it qualifies for: OCG-Verify (envelope well-formed, execution_hash recomputes), OCG-Execute (additionally §21 chain-execution and §22 mandate gates hold), OCG-Prove (additionally a §18 compute-integrity proof verifies). Tiers are cumulative -- any gate false at a level makes every level above it unavailable. The label adds no new gate and mints no new trust claim: it re-expresses existing gate-pass results the caller declares for the referenced artifact, and this node never re-runs those gates itself. When the caller supplies collected section-27.2 human-accountability records, they consume/emit as a section-27.6 evidence bundle keyed to the same artifact hash, so the tier label and the accountability trail ride one diffable object. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.html
tags: ["attestation_mandate", "wave-68", "mcp:assemble_ocg_evidence_bundle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-408-evidence-bundle-tier-labeler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.html
    title: "public tool page"
---

# Evidence Bundle Tier Labeler

> Exports a decision via MCP `assemble_ocg_evidence_bundle` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
