---
type: DecisionTool
title: "Buy-In Exposure Modeler"
description: "Models CSDR Refit last-resort mandatory buy-in exposure: eligible trigger date per asset class, extension period (liquid equity ~7 cal days, gov bond ~12, SME ~22), buy-in cost mark-up (default 5%), and cash-compensation alternative. CSDR Refit buy-in reform pending delegated acts (verify current status)."
resource: https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.html
tags: ["compliance_mandate", "wave-17", "mcp:model_buy_in_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-83-buy-in-exposure-modeler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.html
    title: "public tool page"
---

# Buy-In Exposure Modeler

> Exports a decision via MCP `model_buy_in_exposure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CSDR Cash-Penalty Calculator](./art-78-csdr-penalty-calculator.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
