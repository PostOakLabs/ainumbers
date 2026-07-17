---
type: DecisionTool
title: "FLSA Regular Rate & Overtime Calculator"
description: "FLSA regular rate of pay and overtime premium per 29 CFR 778, Subpart C, including nondiscretionary-bonus reallocation into the regular rate (778.110, 778.208-778.209) and the 0.5x overtime premium for hours over 40 in the workweek (778.107). Federal only, not legal advice; state daily/weekly overtime rules out of scope. Multi-workweek bonus proration is the caller's responsibility: nondiscretionary_bonus_amount is the portion already allocated to the single workweek being computed. Not compute_gross_to_net or compute_federal_withholding, which handle payroll tax withholding rather than wage-hour overtime obligations."
resource: https://ainumbers.co/chaingraph/art-340-compute-flsa-regular-rate.html
tags: ["compliance_mandate", "wave-60", "mcp:compute_flsa_regular_rate"]
timestamp: 2026-07-14
---

# FLSA Regular Rate & Overtime Calculator

> Exports a decision via MCP `compute_flsa_regular_rate` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-340-compute-flsa-regular-rate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
