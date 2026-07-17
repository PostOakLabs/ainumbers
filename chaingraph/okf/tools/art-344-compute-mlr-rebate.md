---
type: DecisionTool
title: "MLR Rebate Calculator"
description: "Medical Loss Ratio numerator/denominator, credibility-adjustment tier, 3-year premium-weighted averaging, and rebate math per 45 CFR 158 (ACA MLR rule). Classifies member life-years into non-credible / partially-credible / fully-credible bands, computes the current-year adjusted MLR and the 3-year average against the market threshold (80% individual/small-group, 85% large-group), and applies the de minimis payment floor."
resource: https://ainumbers.co/chaingraph/art-344-compute-mlr-rebate.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_mlr_rebate"]
timestamp: 2026-07-14
---

# MLR Rebate Calculator

> Exports a decision via MCP `compute_mlr_rebate` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-344-compute-mlr-rebate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
