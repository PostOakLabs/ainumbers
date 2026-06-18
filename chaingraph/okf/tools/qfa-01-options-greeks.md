---
type: DecisionTool
title: "Options Greeks Calculator"
description: ""
resource: https://ainumbers.co/chaingraph/qfa-01-options-greeks.html
tags: ["risk_parameter", "wave-3", "mcp:compute_options_greeks"]
timestamp: 2026-06-18T15:09:48.675Z
---

# Options Greeks Calculator

> Exports a decision via MCP `compute_options_greeks` — mandate type `risk_parameter`.

**Context:** FRTB SA greeks — UK PRA PS1/26 Jan 2027; buy-side pre-validation ahead of FRTB-IMA UK Jan 2028

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/qfa-01-options-greeks.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [XVA / CVA Calculator](./qfa-04-xva-cva-calculator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
