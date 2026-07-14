---
type: DecisionTool
title: "CSDR Cash-Penalty Calculator"
description: "Flagship. Computes the CSDR cash penalty for a settlement fail: selects the asset-class daily rate (incl. Oct-2025 RTS increases: equities 1 bp/day, SSA bonds 0.50 bp/day, non-SSA bonds 0.50 bp/day), applies fail duration and reference price/notional, credits partial settlement, and projects forward penalty exposure over an open-fails set."
resource: https://ainumbers.co/chaingraph/art-78-csdr-penalty-calculator.html
tags: ["compliance_mandate", "wave-17", "mcp:calculate_csdr_penalty"]
timestamp: 2026-07-14
---

# CSDR Cash-Penalty Calculator

> Exports a decision via MCP `calculate_csdr_penalty` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-78-csdr-penalty-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [T+1 Settlement Readiness Diagnostic](./art-77-t1-settlement-readiness-diagnostic.md)

**Feeds:** [Buy-In Exposure Modeler](./art-83-buy-in-exposure-modeler.md), [Settlement Efficiency KPI Engine](./art-84-settlement-efficiency-kpi.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
