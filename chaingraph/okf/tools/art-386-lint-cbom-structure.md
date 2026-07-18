---
type: DecisionTool
title: "CBOM Structural Lint & CNSA-2.0 Classifier"
description: "Validates a pasted CycloneDX 1.6 Cryptography Bill of Materials against a hand-derived field subset and classifies declared algorithm assets as quantum-vulnerable or CNSA-2.0 target-aligned. Structural lint only, every finding asserted, not a scanner."
resource: https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html
tags: ["compliance_mandate", "post-quantum", "mcp:lint_cbom_structure"]
timestamp: 2026-07-18
---

# CBOM Structural Lint & CNSA-2.0 Classifier

> Exports a decision via MCP `lint_cbom_structure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _none yet — PQ-4 chain (CBOM lint → CNSA-2.0 deadline ladder) lands with PQ-2._
