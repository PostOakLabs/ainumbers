---
type: DecisionTool
title: "Credit Concentration Top-N / Sector Checker"
description: "Credit-concentration screen over a flat exposure list (name, sector, amount): returns the top-N single-name exposures by amount, a per-sector rollup, single-name and sector Herfindahl-Hirschman Index (0-10000 scale), and a breach list against caller-declared single-name and sector limit percentages. Concentration limits are your own institution's risk-appetite policy, not a fixed regulatory threshold, so nothing is baked in. Distinct from the shipped IRRBB/NII shock kernels (art-183/art-185/art-369), which measure rate-risk exposure rather than name/sector diversification. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.html
tags: ["analytics_mandate", "wave-72", "mcp:check_credit_concentration_topn_sector"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-445-credit-concentration-topn-sector.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.html
    title: "public tool page"
---

# Credit Concentration Top-N / Sector Checker

> Exports a decision via MCP `check_credit_concentration_topn_sector` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
