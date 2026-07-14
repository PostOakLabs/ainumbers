---
type: DecisionTool
title: "FinCEN CDD 25% Beneficial Ownership Attribution"
description: "Recursive indirect natural-person beneficial ownership computation via ownership-tier multiplication. 25% threshold per FinCEN CDD Rule 31 CFR 1010.230 bank KYB customer due diligence. Returns is_beneficial_owner (bool), total_indirect_pct, and per-natural-person breakdown. Exactly 25% IS a beneficial owner (>=25 threshold). NOT the CTA/BOI domestic reporting rule (31 USC 5336) removed by FinCEN IFR 2025-03-21. For OFAC 50%-Rule sanctions aggregation see art-91-ownership-50pct-aggregator. Synthetic entity IDs only. Zero PII by construction."
resource: https://ainumbers.co/chaingraph/art-268-compute-cdd-ownership-25pct.html
tags: ["compliance_mandate", "wave-45", "mcp:compute_cdd_ownership_25pct"]
timestamp: 2026-07-14
---

# FinCEN CDD 25% Beneficial Ownership Attribution

> Exports a decision via MCP `compute_cdd_ownership_25pct` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-268-compute-cdd-ownership-25pct.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [W-8 Series Structural Validator](./art-269-validate-w8-series-structural.md)
