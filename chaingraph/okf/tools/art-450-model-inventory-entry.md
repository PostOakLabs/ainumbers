---
type: DecisionTool
title: "Model Inventory Entry Builder"
description: "Builds a single model-inventory record for a bank's SR 26-2 model-risk-management inventory: checks the caller-declared attributes (model name, owner, purpose, tier, development/deployment dates, last validation date) against the SR 26-2 required-field set, assigns a proportionality tier (limited/moderate/high) from caller-declared materiality and complexity inputs, and returns a completeness score plus a list of missing required fields. First node in the model-passport lifecycle (inventory entry, then outcome-analysis comparison in art-451, then validation status in art-453). Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program, not a single model's inventory record. Distinct from art-380 (AI workpaper record), which documents a completed assessment rather than registering a model. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-450-model-inventory-entry.html
tags: ["compliance_control", "wave-73", "mcp:build_model_inventory_entry"]
timestamp: 2026-07-14
---

# Model Inventory Entry Builder

> Exports a decision via MCP `build_model_inventory_entry` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-450-model-inventory-entry.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Model Outcome-Analysis Comparison](./art-451-model-outcome-analysis.md)
