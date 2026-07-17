---
type: DecisionTool
title: "LTV/CLTV/HCLTV Ratio Calculator"
description: "Loan-to-value, combined LTV, and home-equity combined LTV per Fannie Mae Selling Guide B2-1.1-03 and Freddie Mac Single-Family Seller/Servicer Guide 5401.1. Applies the lesser-of-value-or-price rule for purchases, appraised value for refinances, and includes the full HELOC credit limit (not just the drawn balance) in HCLTV. Feeds art-222-agency-eligibility-matrix as its LTV/CLTV/HCLTV inputs. Not check_agency_eligibility_matrix itself, which performs the full multi-check eligibility decision."
resource: https://ainumbers.co/chaingraph/art-336-compute-ltv-ratios.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_ltv_ratios"]
timestamp: 2026-07-14
---

# LTV/CLTV/HCLTV Ratio Calculator

> Exports a decision via MCP `compute_ltv_ratios` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-336-compute-ltv-ratios.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agency Eligibility Matrix](./art-222-agency-eligibility-matrix.md)
