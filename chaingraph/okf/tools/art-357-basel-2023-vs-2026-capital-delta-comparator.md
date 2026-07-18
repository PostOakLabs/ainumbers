---
type: DecisionTool
title: "Basel 2023-vs-2026 Capital-Delta Comparator"
description: "Runs the same portfolio through the 2023 Basel III Endgame NPR risk-weight framework and the 2026 reproposal (2026-03-19, three NPRs) framework, then reports the RWA and minimum-capital delta -- the 'reproduce the $87.7bn relief story on OUR book' tool. Representative credit-risk asset-class risk-weight buckets plus a simplified operational-risk SMA business-indicator coefficient, NOT an exhaustive regulatory table. rule_status:'proposed' -- final rule expected ~Q4 2026, re-pin WU pre-authorized at finalization. References compute_rwa_erba_2026 (art-355) and compute_oprisk_sma_2026 (art-356) by tool_id for future chain wiring."
resource: https://ainumbers.co/chaingraph/art-357-basel-2023-vs-2026-capital-delta-comparator.html
tags: ["compliance_mandate", "wave-48", "mcp:compare_basel_2023_vs_2026"]
timestamp: 2026-07-14
---

# Basel 2023-vs-2026 Capital-Delta Comparator

> Exports a decision via MCP `compare_basel_2023_vs_2026` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-357-basel-2023-vs-2026-capital-delta-comparator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
