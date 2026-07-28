---
type: DecisionTool
title: "Solvency II SCR Standard-Formula Module Aggregator"
description: "Aggregates the five Solvency II standard-formula risk-module capital charges (market, counterparty default, life underwriting, health underwriting, non-life underwriting) into Basic SCR via the Delegated Regulation (EU) 2015/35 Annex IV correlation matrix, then adds the operational risk charge and subtracts the loss-absorbing adjustment (deferred tax/technical provisions) to produce total SCR. Delta over calculate_solvency2_scr_ratio (art-180), which takes `scr` as a given input and does not derive it from sub-module charges; feeds art-180's scr input. Not the US NAIC RBC action-level ladder (a different jurisdiction and regime, see compute_rbc_action_level). Solvency II Dir. 2009/138/EC + Del. Reg. (EU) 2015/35 Annex IV. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.html
tags: ["compliance_mandate", "wave-32", "mcp:aggregate_solvency2_scr_modules"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-449-solvency2-scr-module-aggregator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.html
    title: "public tool page"
---

# Solvency II SCR Standard-Formula Module Aggregator

> Exports a decision via MCP `aggregate_solvency2_scr_modules` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Solvency II SCR Ratio Calculator](./art-180-solvency2-scr-ratio-calculator.md)
