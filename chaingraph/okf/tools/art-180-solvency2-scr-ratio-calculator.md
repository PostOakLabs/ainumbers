---
type: DecisionTool
title: "Solvency II SCR Ratio Calculator"
description: "Calculate Solvency II SCR and MCR coverage ratios from eligible own funds and capital requirements. Checks the own-funds SCR tiering limits per Delegated Regulation (EU) 2015/35 Art. 82(1): Tier 1 at least 50% of SCR, Tier 3 less than 15% of SCR, Tier 2 plus Tier 3 at most 50% of SCR, and restricted Tier 1 less than 20% of total Tier 1 (Art. 82(3)). An omitted tier2 is treated as 0, which makes the Tier 2 plus Tier 3 test lenient. The 80% Tier 1 floor is the MCR rule (Art. 82(2)) and is not applied to the SCR; MCR tiering limits and the transitional Tier 1 items are not modelled. Returns scr_coverage_ratio, mcr_coverage_ratio, scr_breached, mcr_breached, tiering_ok, and per-tier percentages. Sec. 16 proof candidate. Root node of the solvency-ii-reconciliation-and-capital chain. Solvency II Dir. 2009/138/EC + Del. Reg. 2015/35. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.html
tags: ["compliance_mandate", "wave-32", "mcp:calculate_solvency2_scr_ratio"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-180-solvency2-scr-ratio-calculator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.html
    title: "public tool page"
---

# Solvency II SCR Ratio Calculator

> Exports a decision via MCP `calculate_solvency2_scr_ratio` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [SII-IFRS 17 Reconciliation Bridger](./art-181-sii-ifrs17-reconciliation-bridger.md)

## Attested computation

[executor + attester binding](../computations/art-180-solvency2-scr-ratio-calculator.md) — §10.2.
