---
type: DecisionTool
title: "Workforce Board ROI Report"
description: "Workforce program ROI report generator ported from ApexLogics Apex #15 (AL-07). From a program budget, enrollment and WIOA outcome data the node computes cost per participant, cost per employed exit (Q2) and cost per credential; a five-indicator benchmark scorecard against the WIOA PY 2023 target sets for adult, dislocated-worker and youth programs (each indicator exceeds, meets, below or not applicable); an annualized wage gain against the official BLS QCEW Q3 2023 sector baseline for twelve sector keys; a fixed-rate annual taxpayer tax-recapture estimate, a break-even horizon, a three-year net benefit and a three-year return per dollar; and an overall ROI grade (Excellent, Strong, Moderate, Below Target, Scored or Pending Data). Missing required fields and out-of-domain values are named refusals, never throws. Sector baselines are official QCEW Q3 2023 private-sector weekly wage x52 constants; the WIOA PY 2023 target values ride in-kernel flagged UNGROUNDED pending an official DOL ETA source, and the 30 percent tax-recapture rate is a modeling assumption, not a statutory rate."
resource: https://ainumbers.co/chaingraph/art-712-workforce-board-roi.html
tags: ["workforce_program_roi", "wave-123", "mcp:workforce_board_roi_report"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-712-workforce-board-roi.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-712-workforce-board-roi.html
    title: "public tool page"
---

# Workforce Board ROI Report

> Exports a decision via MCP `workforce_board_roi_report` — mandate type `workforce_program_roi`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-712-workforce-board-roi.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-712-workforce-board-roi.md) — §10.2.
