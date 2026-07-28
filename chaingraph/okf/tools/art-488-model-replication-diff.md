---
type: DecisionTool
title: "Model Replication Diff"
description: "Independently recomputes a model's reported outputs from a declared model specification (version, as-of date, transform, intercept, coefficients) and a stated input record set, then diffs the recomputation against the model's own reported outputs within a caller-supplied tolerance. Returns a per-record diff (reported, recomputed, absolute and relative diff, within-tolerance), aggregate tolerance stats, an overall replicated / not-replicated verdict, and the failing segment(s) named when not replicated. If the declared specification cannot be recomputed as stated -- unrecognized transform, no coefficients, no tolerance -- the honest result is not_replicable_as_specified with a reason, not a forced pass or fail. Deterministic recompute-and-diff only: this node never opines on conceptual soundness, assumption reasonableness, or fitness for use -- that judgment belongs in a validator's approval record, not here. Model inputs and specifications are expected to arrive as a workbook export via the shipped WB-BRIDGE-1 workbook-to-OCG artifact bridge (tool 554); this node itself accepts plain JSON records so any upstream source can feed it. Distinct from the shipped model-passport nodes (art-450/451/453), which track a model's inventory tier and revalidation cadence rather than recomputing its numeric output. Inline deterministic transcendental math (no engine Math.exp/log) so the same input always produces the same execution_hash on every surface. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-488-model-replication-diff.html
tags: ["compliance_control", "wave-77", "mcp:replicate_model_outputs"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-488-model-replication-diff.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-488-model-replication-diff.html
    title: "public tool page"
---

# Model Replication Diff

> Exports a decision via MCP `replicate_model_outputs` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-488-model-replication-diff.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-488-model-replication-diff.md) — §10.2.
