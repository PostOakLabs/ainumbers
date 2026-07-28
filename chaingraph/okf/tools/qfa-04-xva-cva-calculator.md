---
type: DecisionTool
title: "XVA / CVA Calculator"
description: "Monte Carlo XVA/CVA calculator. Simulates expected-exposure profiles for IRS, FX forwards, and CDS; computes CVA, DVA, FVA via discounted expected positive/negative exposure. Zero-egress."
resource: https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.html
tags: ["risk_parameter", "wave-3", "mcp:calculate_xva"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/qfa-04-xva-cva-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.html
    title: "public tool page"
---

# XVA / CVA Calculator

> Exports a decision via MCP `calculate_xva` — mandate type `risk_parameter`.

**Context:** Basel III SA-CVA (BCBS d325) ongoing; FRTB CVA desk requirements — UK PRA PS1/26 Jan 2027

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Options Greeks Calculator](./qfa-01-options-greeks.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
