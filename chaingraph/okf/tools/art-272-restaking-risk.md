---
type: DecisionTool
title: "Restaking Delegation and Slashing Risk Analyzer"
description: "Models restaking delegation rewards, operator fees, AVS yield, and slashing-waterfall risk for EigenLayer and Symbiotic. Computes slashing exposure through a configurable first-loss buffer-tranche model, probability-weighted expected annual slash cost, and slashing-insurance economics. Not financial advice."
resource: https://ainumbers.co/chaingraph/art-272-restaking-risk.html
tags: ["analytics_mandate", "wave-46", "mcp:assess_restaking_risk"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-272-restaking-risk.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-272-restaking-risk.html
    title: "public tool page"
---

# Restaking Delegation and Slashing Risk Analyzer

> Exports a decision via MCP `assess_restaking_risk` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-272-restaking-risk.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-272-restaking-risk.md) — §10.2.
