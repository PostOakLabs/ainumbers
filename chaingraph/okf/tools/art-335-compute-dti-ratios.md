---
type: DecisionTool
title: "DTI Ratio Calculator"
description: "Front-end (housing) and back-end (total) debt-to-income ratios per Fannie Mae Selling Guide B3-6-02 and Freddie Mac Single-Family Seller/Servicer Guide 5401.2. Classifies the back-end ratio into a standard-manual / extended-manual-compensating-factors / DU-LPA-only / exceeds-max tier and flags whether the loan is within the max DTI for the selected underwriting type (DU, LPA, or manual). Feeds art-222-agency-eligibility-matrix as one of its DTI inputs. Not check_agency_eligibility_matrix itself, which performs the full multi-check eligibility decision."
resource: https://ainumbers.co/chaingraph/art-335-compute-dti-ratios.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_dti_ratios"]
timestamp: 2026-07-14
---

# DTI Ratio Calculator

> Exports a decision via MCP `compute_dti_ratios` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-335-compute-dti-ratios.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agency Eligibility Matrix](./art-222-agency-eligibility-matrix.md)
