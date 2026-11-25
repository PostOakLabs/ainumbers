---
type: DecisionTool
title: "Shariah Equity Purification"
description: "Screens one company's caller-supplied financials under four pinned Shariah screening methodologies, each as its own independent verdict group that is never merged with another: the long-form ratios at 33.33% of total assets (30% for new entrants), the 36-month average month-end market-cap variant with its widened receivables row, the daily-average screens at 33% of the supplied average market cap with a fallback to total assets when the average falls below the asset value, a 5% business-activity row and a 5% non-permissible-income row, and the conservative 25%/3%/90% screen with imputed returns at 7.5%. Every threshold comparison is exact integer cross-multiplication (equality passes, one minor unit over fails), amounts are integer minor units with declared bounds, averages are reported floored with named rounding while verdicts use exact values, the compliant-debt country carve-out subtracts only for eleven pinned country codes, and dividend purification runs per profile (long-form adjustment factor, conservative pro-rata ratio, named residuals; the daily-average profile pins no purification rule and says so). Methodologies it does not implement, such as S&P Shariah, Dow Jones Islamic Market, Malaysia SC SAC screening and AAOIFI SS 21, refuse by name rather than approximating. Every payload carries not_a_shariah_ruling: the node outputs verdict rows and purification arithmetic only, never a ruling, certification or opinion."
resource: https://ainumbers.co/chaingraph/art-850-shariah-equity-purification.html
tags: ["compliance_control", "wave-150", "mcp:screen_shariah_equity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-850-shariah-equity-purification.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-850-shariah-equity-purification.html
    title: "public tool page"
---

# Shariah Equity Purification

> Exports a decision via MCP `screen_shariah_equity` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-850-shariah-equity-purification.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-850-shariah-equity-purification.md) — §10.2.
