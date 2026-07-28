---
type: DecisionTool
title: "Basel 3.1 Reporting Delta Calculator"
description: "Per-asset-class RWA delta (current vs Basel 3.1), output-floor binding analysis (72.5%), CET1 before/after, capital shortfall vs 12.5% total requirement. Six asset classes. Tornado chart. UK PRA PS1/26 go-live Jan 1, 2027."
resource: https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.html
tags: ["capital_assessment", "wave-2", "mcp:compute_basel31_delta"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-07-basel31-reporting-delta-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.html
    title: "public tool page"
---

# Basel 3.1 Reporting Delta Calculator

> Exports a decision via MCP `compute_basel31_delta` — mandate type `capital_assessment`.

**Deadline:** 2027-01-01 — UK PRA PS1/26 Basel 3.1 go-live — January 1, 2027

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Basel RWA Scenario Modeler](./sim-03-basel-rwa-scenario-modeler.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
