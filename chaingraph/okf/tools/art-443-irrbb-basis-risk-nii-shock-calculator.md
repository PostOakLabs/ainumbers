---
type: DecisionTool
title: "IRRBB Basis-Risk NII Shock Calculator"
description: "Comptroller's Handbook IRR basis-risk delta-NII calculator: sweeps a single reference-rate shock across multiple priced indices (Prime, SOFR, Fed Funds, CD portfolio, etc.), each with a caller-declared historical beta vs the reference rate, and isolates the incremental delta-NII from indices not moving in lockstep. Distinct from art-369 (Rate Shock Ladder Replay), whose parallel-curve convention assumes one shock moves the entire gap schedule uniformly and cannot see basis risk. Complements art-369 and art-442 as the third leg of a full NII/EVE-shock toolkit. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.html
tags: ["analytics_mandate", "wave-73", "mcp:calculate_basis_risk_nii_shock"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-443-irrbb-basis-risk-nii-shock-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.html
    title: "public tool page"
---

# IRRBB Basis-Risk NII Shock Calculator

> Exports a decision via MCP `calculate_basis_risk_nii_shock` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-443-irrbb-basis-risk-nii-shock-calculator.md) — §10.2.
