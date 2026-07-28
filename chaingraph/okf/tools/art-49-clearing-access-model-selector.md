---
type: DecisionTool
title: "Clearing Access Model Selector"
description: "Selects and costs the FICC access model - Direct vs Sponsored (done-with) vs Sponsored/Agent (done-away) - across cost, execution-access, margin/netting efficiency, and ops. Recommends a model with a CFO memo. Educational economics; not clearing advice."
resource: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html
tags: ["treasury_mandate", "wave-11", "mcp:model_clearing_access_economics"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-49-clearing-access-model-selector.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html
    title: "public tool page"
---

# Clearing Access Model Selector

> Exports a decision via MCP `model_clearing_access_economics` — mandate type `treasury_mandate`.

**Deadline:** 2026-12-31 — flagship access-model decision (W-A).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Treasury Clearing Fit Diagnostic](./art-48-treasury-clearing-fit-diagnostic.md)

**Feeds:** [Settlement-Risk Capital Efficiency Optimizer](./504-settlement-risk-capital-optimizer.md), [FICC Margin & Netting Estimator](./art-50-ficc-margin-netting-estimator.md)

## Attested computation

[executor + attester binding](../computations/art-49-clearing-access-model-selector.md) — §10.2.
