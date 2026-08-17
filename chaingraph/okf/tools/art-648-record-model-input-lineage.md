---
type: DecisionTool
title: "Record Model Input Lineage"
description: "Attests attribute-level data lineage for a model's input data, which source system, which field, what transformation was applied, feeding which model run, distinct from every existing model-risk node (art-450/451/453/488/489), none of which attest where a model's input data came from, only what the model did with declared inputs. Input attributes are SUPPLIED and asserted by the caller (zero-egress); this node never fetches or validates against a live data warehouse or source system. An attribute declared without a source_system is reported as a legitimate finding (unmapped_attribute_count), never silently dropped or treated as an error. run_ref is optional, a caller with no model-run artifact yet still gets a valid lineage receipt. ECB Guide on effective risk data aggregation and risk reporting (May 2024) §3.4(3) requires complete, up-to-date data lineages on data attribute level for the risk indicators and critical data elements within scope; this node gives that its own citable artifact. SR 26-2 (effective 2026-04-17) scopes the model-risk context to conventional quantitative models only. Feeds the model-risk-lineage-pack chain (art-562) as an optional additional citation, never a required one."
resource: https://ainumbers.co/chaingraph/art-648-record-model-input-lineage.html
tags: ["attestation_mandate", "wave-104", "mcp:record_model_input_lineage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-648-record-model-input-lineage.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-648-record-model-input-lineage.html
    title: "public tool page"
---

# Record Model Input Lineage

> Exports a decision via MCP `record_model_input_lineage` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-648-record-model-input-lineage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Model Outcome-Analysis Comparison](./art-451-model-outcome-analysis.md), [Model Replication Diff](./art-488-model-replication-diff.md)

**Feeds:** [Compile Model Risk Lineage Pack](./art-562-compile-model-risk-lineage-pack.md)

## Attested computation

[executor + attester binding](../computations/art-648-record-model-input-lineage.md) — §10.2.
