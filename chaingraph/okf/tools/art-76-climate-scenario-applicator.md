---
type: DecisionTool
title: "Climate Scenario Applicator (NGFS / Fit-for-55)"
description: "Applies a climate scenario path (NGFS Phase V orderly/disorderly/hot-house, Fit-for-55 supervisory; reference_version NGFS-Phase-V-2025) to an exposure set, emitting stress-adjusted metrics for a bank/insurer climate-risk file. Scenario paths are versioned reference data, not the suite financial-shock stress parameters."
resource: https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.html
tags: ["model_governance", "wave-16", "mcp:apply_climate_scenario"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-76-climate-scenario-applicator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.html
    title: "public tool page"
---

# Climate Scenario Applicator (NGFS / Fit-for-55)

> Exports a decision via MCP `apply_climate_scenario` — mandate type `model_governance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Carbon & Climate Compliance Fit Diagnostic](./art-68-carbon-compliance-fit-diagnostic.md), [CBAM Certificate Cost & Free-Allocation Engine](./art-71-cbam-certificate-cost-engine.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-76-climate-scenario-applicator.md) — §10.2.
