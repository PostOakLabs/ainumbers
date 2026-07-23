---
type: DecisionTool
title: "CECL Expected Credit Loss & Allowance Calculator"
description: "Computes a deterministic CECL (Current Expected Credit Loss, ASC 326) allowance given caller-supplied PD/LGD/EAD curves, segment exposures, and forecast scenario weights, and reconciles the result against the prior period's allowance balance. Supports WARM (Weighted-Average Remaining Maturity -- an annualized historical loss rate x remaining life practical-expedient approach), DCF (full contractual cash-flow projection, discounted at the effective interest rate, with period expected shortfall = contractual payment x PD x LGD), and straight loss-rate (a lifetime historical loss rate applied directly to exposure, no discounting) methods. BOUNDARY: PD/LGD/EAD curves and forecast scenario weights are policy inputs supplied by the caller -- human or model judgment -- and this kernel performs only the arithmetic combination into per-segment ECL and the allowance rollforward (beginning balance + provision expense - charge-offs + recoveries = ending allowance, checked against the newly computed required allowance). It does not estimate, calibrate, back-test, or validate any PD/LGD/EAD model. Distinct from IFRS9's 3-stage staging regime (see tools 196/198/204, a different accounting standard) -- CECL recognizes lifetime expected credit losses from origination with no staging transfer logic."
resource: https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html
tags: ["credit_assessment", "wave-70", "mcp:calculate_cecl_ecl_allowance"]
timestamp: 2026-07-14
---

# CECL Expected Credit Loss & Allowance Calculator

> Exports a decision via MCP `calculate_cecl_ecl_allowance` — mandate type `credit_assessment`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
