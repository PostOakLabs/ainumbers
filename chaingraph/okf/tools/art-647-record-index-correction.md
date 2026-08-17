---
type: DecisionTool
title: "Record Index Correction"
description: "art-557 already covers constituent-set corrections via the SPEC.md top-level supersedes field; this node adds the equivalent for a published index level or weight-set value, the case BMR calls an index restatement: a level or weight was published, then found wrong, and corrected. HARD FENCE: this kernel attests THAT a correction was declared, by whom (the caller-supplied original_value_ref), and why (reason_code); it does not itself verify the corrected value against a third-party recomputation, and it creates no reverse link or status registry, SPEC.md §1 is explicit that supersession is discoverable only from the newer artifact or a log scan. Fourth entry of the Financial Index/Benchmark Administrator Lineage family. Two separate regimes, cited separately: EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1)(e) (traceable and verifiable) is the cited traceability rationale; SEBI (Index Providers) Regulations, 2024 was searched and has no located provision governing correction or restatement of a published index value, recorded here as an explicit N/A, not silently inherited. This kernel makes no compliance claim under either regime."
resource: https://ainumbers.co/chaingraph/art-647-record-index-correction.html
tags: ["attestation_mandate", "wave-106", "mcp:record_index_correction"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-647-record-index-correction.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-647-record-index-correction.html
    title: "public tool page"
---

# Record Index Correction

> Exports a decision via MCP `record_index_correction` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-647-record-index-correction.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-647-record-index-correction.md) — §10.2.
