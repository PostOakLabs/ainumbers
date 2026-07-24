---
type: DecisionTool
title: "AI Training-Data Lineage Record"
description: "Composes a hash-chained ML training-data lineage record: dataset identity, dataset version, upstream source dataset references, a declared collection/governance method, and an OPTIONAL reference to an existing OCG receipt for the training-run compute (tool identity, execution hash, kernel digest -- never re-embedded). Chains to a prior lineage record via sha256_prev_lineage_hash. Maps to EU AI Act Art 10 (data and data governance) + Annex IV 2(d) technical-documentation elements (data provenance, collection, labelling, cleaning); SR 11-7 model risk management data-lineage practice as the US domestic analog. Documents dataset lineage only -- does not validate dataset quality, bias, or representativeness. Not build_ai_decision_log_record (art-236, per-inference decision chain) and not build_ai_workpaper_record (art-380, audit workpaper over a receipt)."
resource: https://ainumbers.co/chaingraph/art-452-build-ai-training-data-lineage-record.html
tags: ["compliance_mandate", "wave-66", "mcp:build_ai_training_data_lineage_record"]
timestamp: 2026-07-14
---

# AI Training-Data Lineage Record

> Exports a decision via MCP `build_ai_training_data_lineage_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-452-build-ai-training-data-lineage-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
