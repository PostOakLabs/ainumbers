---
type: DecisionTool
title: "RAROC Loan Pricing Calculator"
description: "Risk-Adjusted Return on Capital (RAROC) loan pricing per Basel II BCBS 128 (2006) / Basel III BCBS 189 (2010) simplified public approximation of the IRB economic-capital formula (single-factor Vasicek model at 99.9% confidence, or the SA risk-weight bucket table). Returns RAROC versus hurdle rate, economic capital, net income waterfall, and the break-even spread. Provable node counterpart to tools/437-raroc-loan-pricing.html; simplified public approximation, not a substitute for an internally approved IRB model."
resource: https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.html
tags: ["compliance_mandate", "wave-62", "mcp:compute_raroc_loan_price"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-362-compute-raroc-loan-price.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.html
    title: "public tool page"
---

# RAROC Loan Pricing Calculator

> Exports a decision via MCP `compute_raroc_loan_price` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-362-compute-raroc-loan-price.md) — §10.2.
