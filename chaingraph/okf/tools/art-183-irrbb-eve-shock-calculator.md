---
type: DecisionTool
title: "IRRBB EVE Shock Calculator"
description: "Calculate Delta Economic Value of Equity (EVE) under the 6 BCBS d368 / EBA standardised IRRBB shock scenarios (parallel up, parallel down, short up, short down, steepener, flattener), recalibrated effective 1 Jan 2026. Duration-based sensitivity over 6 standardised repricing time buckets using a 200bp reference parallel shock and the BCBS d368 Annex 2 short/long tenor scalars. Returns per-scenario delta_eve, worst_scenario, and worst_delta_eve. Root node of the irrbb-supervisory-outlier-test chain. BCBS d368 (2024 recalibration). NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-183-irrbb-eve-shock-calculator.html
tags: ["compliance_mandate", "wave-33", "mcp:calculate_irrbb_eve_shocks"]
timestamp: 2026-07-14
---

# IRRBB EVE Shock Calculator

> Exports a decision via MCP `calculate_irrbb_eve_shocks` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-183-irrbb-eve-shock-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IRRBB SOT EVE Evaluator](./art-184-irrbb-sot-eve-evaluator.md)
