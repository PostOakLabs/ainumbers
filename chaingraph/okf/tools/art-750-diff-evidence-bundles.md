---
type: DecisionTool
title: "Diff Evidence Bundles"
description: "Evidence-bundle diff: takes two parsed JSON bundles (bundle_a = baseline, bundle_b = comparison) plus an optional as_of timestamp and reports, as values only, what moved between them. Inputs are classified the same way the estate's verification desk classifies them (OCG artifact carrying an execution_hash, chain given as a step-artifact array or a steps array, evidence bundle carrying a subject_hash without an execution_hash, or a records array); anything else is refused by throw with a named reason. Four comparison sections follow: hash- and digest-bearing fields (execution_hash, subject_hash, receipt hashes, chained workpaper hashes), version-bearing fields, a normalized human-accountability view (approval, rejection and override membership sets plus threshold or gate-policy fields, where a legacy records array, an embedded sign_off and the converged evidence-bundle shape all normalize to the same keys so a shape migration alone never surfaces as a diff row), and the verdict, taken from verification_result first, then explicit verdict-family fields, then derived from a checks array, with a regressed flag when the verdict moved toward fail, reject or hold. Nesting is capped at 200 levels for hostile-input safety. The one wall-clock read the source page performs (override freshness) is a caller-supplied as_of parameter here: it is required whenever an override record is present. The node ports the internal comparison math of the existing root page bundle-diff.html (kept untouched) so an MCP auditor gets an execution_hash-bearing result instead of a page-only view. compute_proof_ready is deferred; the kernel is pure structural comparison with no float arithmetic, no transcendentals and no loop bound taken from policy_parameters."
resource: https://ainumbers.co/chaingraph/art-750-diff-evidence-bundles.html
tags: ["compliance_control", "wave-134", "mcp:compute_diff_evidence_bundles"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-750-diff-evidence-bundles.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-750-diff-evidence-bundles.html
    title: "public tool page"
---

# Diff Evidence Bundles

> Exports a decision via MCP `compute_diff_evidence_bundles` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-750-diff-evidence-bundles.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-750-diff-evidence-bundles.md) — §10.2.
