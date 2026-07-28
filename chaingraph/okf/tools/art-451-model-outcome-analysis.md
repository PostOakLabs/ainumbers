---
type: DecisionTool
title: "Model Outcome-Analysis Comparison"
description: "SR 26-2 ongoing-monitoring backtest: compares a list of period predicted-vs-actual model outcomes, computes per-period absolute percent error, mean/max absolute percent error, and flags periods breaching a caller-declared error tolerance. Returns a pass/fail outcome status against a caller-declared maximum breach rate. Second node in the model-passport lifecycle (after art-450 inventory entry, before art-453 validation status). Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program rather than backtest one model's outcomes. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.html
tags: ["compliance_control", "wave-73", "mcp:compare_model_outcome_analysis"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-451-model-outcome-analysis.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.html
    title: "public tool page"
---

# Model Outcome-Analysis Comparison

> Exports a decision via MCP `compare_model_outcome_analysis` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Model Inventory Entry Builder](./art-450-model-inventory-entry.md)

**Feeds:** [Model Validation Status Assessor](./art-453-model-validation-status.md)

## Attested computation

[executor + attester binding](../computations/art-451-model-outcome-analysis.md) — §10.2.
