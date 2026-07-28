---
type: DecisionTool
title: "Solvency II SCR Ratio Calculator"
description: "Calculate Solvency II SCR and MCR coverage ratios from eligible own funds and capital requirements. Checks the three own-funds tiering limits per Delegated Regulation (EU) 2015/35: Tier-1 unrestricted >= 50% of SCR, Tier-1 total >= 80% of SCR, Tier-3 <= 15% of SCR. Returns scr_coverage_ratio, mcr_coverage_ratio, scr_breached, mcr_breached, tiering_ok, and per-tier percentages. Sec. 16 proof candidate. Root node of the solvency-ii-reconciliation-and-capital chain. Solvency II Dir. 2009/138/EC + Del. Reg. 2015/35. NaN-safe. Zero network, zero PII."
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
