---
type: DecisionTool
title: "IRRBB SOT EVE Evaluator"
description: "Evaluate the EBA Supervisory Outlier Test (SOT) on Economic Value of Equity: the worst-case delta EVE decline across the 6 standardised shock scenarios versus the EU-wide hard threshold of 15% of Tier 1 capital (EBA RTS on the SOT / EBA Guidelines on IRRBB and CSRBB, EBA/GL/2022/14). Returns delta_eve_pct_of_tier1 and eve_outlier. Section 16 proof candidate. Second node of the irrbb-supervisory-outlier-test chain. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-184-irrbb-sot-eve-evaluator.html
tags: ["compliance_mandate", "wave-33", "mcp:evaluate_irrbb_sot_eve"]
timestamp: 2026-07-14
---

# IRRBB SOT EVE Evaluator

> Exports a decision via MCP `evaluate_irrbb_sot_eve` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-184-irrbb-sot-eve-evaluator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IRRBB EVE Shock Calculator](./art-183-irrbb-eve-shock-calculator.md)

**Feeds:** [IRRBB SOT NII Evaluator](./art-185-irrbb-sot-nii-evaluator.md)
