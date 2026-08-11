---
type: DecisionTool
title: "Compile Model Risk Lineage Pack"
description: "Compiles a model's current model-passport-lifecycle (art-450-model-inventory-entry, art-451-model-outcome-analysis, art-453-model-validation-status) and model-validation-cycle (art-488-model-replication-diff, art-489-model-test-battery) artifacts, cited by execution_hash and never recomputed, into a single BCBS 239 SS II / RDARR-shaped bundle: inventory tier, outcome-analysis result, validation status, replication verdict, and test-battery result, each with its citing hash and producing tool, so a reviewer sees one document that traces every SR 26-2 assertion back to the artifact that made it. Each of the five stage references is optional individually; the pack reports which stages are cited and which are absent, and zero-stages-cited is a legitimate empty state, never an error. HARD FENCE: this pack cites the referenced receipts, it does not re-run the model, re-derive the outcome analysis, or itself opine on validation sufficiency -- that opinion, if any, belongs to the cited art-453/art-489 artifacts, never to this bundle. SR 26-2 (superseding SR 11-7, effective 2026-04-17) scopes this pack to conventional quantitative models in scope under that guidance; it makes no claim about gen-AI or agentic-AI systems. Corrections cite the prior artifact via the SPEC.md top-level supersedes field, not a bespoke status registry."
resource: https://ainumbers.co/chaingraph/art-562-compile-model-risk-lineage-pack.html
tags: ["compliance_mandate", "wave-91", "mcp:compile_model_risk_lineage_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-562-compile-model-risk-lineage-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-562-compile-model-risk-lineage-pack.html
    title: "public tool page"
---

# Compile Model Risk Lineage Pack

> Exports a decision via MCP `compile_model_risk_lineage_pack` — mandate type `compliance_mandate`.

**Context:** No statutory deadline; a model-risk lineage pack is compiled on demand for a review or examination request, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-562-compile-model-risk-lineage-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Model Inventory Entry Builder](./art-450-model-inventory-entry.md), [Model Outcome-Analysis Comparison](./art-451-model-outcome-analysis.md), [Model Validation Status Assessor](./art-453-model-validation-status.md), [Model Replication Diff](./art-488-model-replication-diff.md), [Model Test Battery](./art-489-model-test-battery.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-562-compile-model-risk-lineage-pack.md) — §10.2.
