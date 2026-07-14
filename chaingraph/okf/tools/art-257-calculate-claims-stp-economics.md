---
type: DecisionTool
title: "Claims STP Economics Calculator"
description: "Computes the financial business case for insurance claims Straight-Through Processing (STP) automation. Models handling cost reduction from current to target STP rates, leakage delta (change in claim payment leakage from automated vs manual handling), net annual benefit, NPV over a configurable projection horizon, IRR, and per-claim cost reduction. Covers industry benchmarks from McKinsey Insurance 2024, Accenture Claims Transformation 2025, and Majesco Claims Technology Survey 2024. Use in insurer-rbc-action-level chain (downstream when capital below 200% ACL triggers corrective action). ZERO PII: aggregate portfolio metrics only."
resource: https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.html
tags: ["analytics_mandate", "wave-43", "mcp:calculate_claims_stp_economics"]
timestamp: 2026-07-14
---

# Claims STP Economics Calculator

> Exports a decision via MCP `calculate_claims_stp_economics` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [NAIC RBC Action Level Calculator](./art-254-compute-rbc-action-level.md)

**Feeds:** _terminal node_
