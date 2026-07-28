---
type: DecisionTool
title: "IRRBB SOT NII Evaluator"
description: "Evaluate the Net Interest Income (NII) leg of the EBA Supervisory Outlier Test: the worst-case 1-year delta NII under parallel up/down shocks versus a caller-supplied threshold (EBA leaves NII SOT calibration to competent-authority / institution discretion under EBA Guidelines on IRRBB and CSRBB, EBA/GL/2022/14 -- no single EU-wide bright-line percentage exists, unlike the EVE leg). Returns delta_nii_pct_of_nii, threshold_set, and nii_outlier. Terminal node of the irrbb-supervisory-outlier-test chain. Exports as Policy Mandate JSON or W3C VC. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.html
tags: ["compliance_mandate", "wave-33", "mcp:evaluate_irrbb_sot_nii"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-185-irrbb-sot-nii-evaluator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.html
    title: "public tool page"
---

# IRRBB SOT NII Evaluator

> Exports a decision via MCP `evaluate_irrbb_sot_nii` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [IRRBB SOT EVE Evaluator](./art-184-irrbb-sot-eve-evaluator.md)

**Feeds:** _terminal node_
