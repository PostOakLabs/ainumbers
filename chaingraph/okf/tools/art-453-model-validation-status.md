---
type: DecisionTool
title: "Model Validation Status Assessor"
description: "Determines a model's SR 26-2 validation status by combining its proportionality tier, last-validation date, and most recent outcome-analysis result against a tier-based revalidation cadence (high=365 days, moderate=730, limited=1095, overridable). Returns validated / conditionally-approved / validation-overdue / restricted-use / validation-required plus days-since-validation and next-due-in-days. Third and final node in the model-passport lifecycle (after art-450 inventory entry and art-451 outcome-analysis comparison) -- the passport's headline field. Dates are caller-declared (as_of_date) and diffed with integer civil-calendar arithmetic, never the system clock, so the result is fully deterministic. Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program rather than one model's cadence status. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-453-model-validation-status.html
tags: ["compliance_control", "wave-73", "mcp:assess_model_validation_status"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-453-model-validation-status.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-453-model-validation-status.html
    title: "public tool page"
---

# Model Validation Status Assessor

> Exports a decision via MCP `assess_model_validation_status` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-453-model-validation-status.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Model Outcome-Analysis Comparison](./art-451-model-outcome-analysis.md)

**Feeds:** _terminal node_
