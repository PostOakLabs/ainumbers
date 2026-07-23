---
type: DecisionTool
title: "CECL Expected Credit Loss & Allowance Calculator"
description: "Computes a deterministic CECL (Current Expected Credit Loss, ASC 326) allowance from caller-supplied PD/LGD/EAD curves, segment exposures, and forecast scenario weights -- WARM, DCF, and loss-rate methods -- and reconciles the result against the prior period's allowance balance. PD/LGD/EAD curves and forecast weights are policy inputs supplied by the caller; this tool performs only the arithmetic combination into ECL and allowance reconciliation, and does not estimate, calibrate, or validate any PD/LGD/EAD model. Distinct from IFRS9's 3-stage staging regime (tools 196/198/204)."
resource: https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html
tags: ["credit_assessment", "wave-70", "mcp:calculate_cecl_ecl_allowance"]
timestamp: 2026-07-23
---

# CECL Expected Credit Loss & Allowance Calculator

> Exports a decision via MCP `calculate_cecl_ecl_allowance` — mandate type `credit_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _none yet_
