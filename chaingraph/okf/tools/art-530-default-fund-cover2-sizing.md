---
type: DecisionTool
title: "CCP Default Fund Cover-2 Sizing"
description: "Sizes a CCP default fund under the PFMI Principle 4 \"Cover 2\" standard: fund size must be at least the largest plus second-largest clearing-member stress loss across caller-declared stress scenarios. Applies each caller-declared scenario loss rate (in basis points, shaped from qfa-03-stress-test-engine's scenario_losses output as a chained input) to every caller-declared member exposure, ranks members per scenario, takes the two largest, and checks a caller-declared fund size against the worst scenario across the declared set. Not a stress-loss engine itself -- qfa-03 already computes multi-scenario portfolio stress losses; this node consumes that shape read-only and never reimplements it. Region-portable: no CCP, currency, or jurisdiction is hardcoded. Arithmetic sizing check only, no fund-size recommendation."
resource: https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.html
tags: ["risk_parameter", "wave-81", "mcp:size_ccp_default_fund_cover2"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-530-default-fund-cover2-sizing.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.html
    title: "public tool page"
---

# CCP Default Fund Cover-2 Sizing

> Exports a decision via MCP `size_ccp_default_fund_cover2` — mandate type `risk_parameter`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Stress Test Engine](./qfa-03-stress-test-engine.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-530-default-fund-cover2-sizing.md) — §10.2.
