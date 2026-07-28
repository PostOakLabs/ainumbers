---
type: DecisionTool
title: "LCR / NSFR / Leverage Ratio Calculator"
description: "Basel III Liquidity Coverage Ratio (BCBS 238), Net Stable Funding Ratio (BCBS 295), and Leverage Ratio (BCBS 270, finalized BCBS 360) point-in-time calculator from caller-supplied HQLA positions, outflow/inflow categories, ASF/RSF items, and capital/exposure figures. Deterministic single-scenario point calculation, distinct from the Monte Carlo stress distribution in sim-01-lcr-nsfr-liquidity-stress-test. Provable node counterpart to tools/469-lcr-calculator.html, tools/470-nsfr-calculator.html, and tools/471-leverage-ratio-calculator.html."
resource: https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.html
tags: ["compliance_mandate", "wave-62", "mcp:compute_lcr_nsfr_leverage"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-364-compute-lcr-nsfr-leverage.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.html
    title: "public tool page"
---

# LCR / NSFR / Leverage Ratio Calculator

> Exports a decision via MCP `compute_lcr_nsfr_leverage` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-364-compute-lcr-nsfr-leverage.md) — §10.2.
