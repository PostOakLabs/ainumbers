---
type: DecisionTool
title: "Large Exposures Limit Check"
description: "Basel III large exposures framework (BCBS 283) and U.S. single-counterparty credit limits (Regulation YY, 12 CFR 252 Subpart H) limit check: exposure net of eligible CRM vs Tier 1 capital, 25% general / 15% GSIB-to-GSIB thresholds, connected-group rollup, breach-list artifact. Deterministic point-in-time calculation from caller-supplied exposure, CRM, and capital figures for a single reporting date."
resource: https://ainumbers.co/chaingraph/art-425-large-exposures-limit-check.html
tags: ["compliance_mandate", "wave-70", "mcp:compute_large_exposures_limit"]
timestamp: 2026-07-23
---

# Large Exposures Limit Check

> Exports a decision via MCP `compute_large_exposures_limit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-425-large-exposures-limit-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
