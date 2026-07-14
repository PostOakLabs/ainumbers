---
type: DecisionTool
title: "NIST AI RMF Function Mapper"
description: "Map supplied AI controls and evidence to NIST AI RMF Govern (5 controls), Map (4), Measure (4), and Manage (4) functions: 17 controls total. Returns per-function coverage scores (0-100), coverage_band (Minimal/Partial/Substantial/Comprehensive), overall_coverage, and structured gap lists by function. Root node of the ai-governance-framework-crosswalk chain. NIST AI RMF 1.0 (2023). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-174-nist-ai-rmf-function-mapper.html
tags: ["compliance_mandate", "wave-31", "mcp:map_nist_ai_rmf_functions"]
timestamp: 2026-07-14
---

# NIST AI RMF Function Mapper

> Exports a decision via MCP `map_nist_ai_rmf_functions` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-174-nist-ai-rmf-function-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [GPAI Code of Practice Conformance](./art-175-gpai-code-of-practice-conformance.md), [TRAIGA Safe Harbor Pack Builder](./art-314-traiga-safe-harbor-pack-builder.md)
