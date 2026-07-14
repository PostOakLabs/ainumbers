---
type: DecisionTool
title: "CBAM Certificate Cost & Free-Allocation Engine"
description: "Converts embedded emissions into a CBAM certificate liability: applies the CBAM factor (free-allocation phase-out 2.5% 2026 to 100% 2034), deducts origin carbon price already paid, and projects the quarterly holding and surrender schedule to the 30 Sep deadline."
resource: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html
tags: ["compliance_mandate", "wave-16", "mcp:model_cbam_certificate_cost"]
timestamp: 2026-07-14
---

# CBAM Certificate Cost & Free-Allocation Engine

> Exports a decision via MCP `model_cbam_certificate_cost` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CBAM Embedded-Emissions Calculator](./art-69-cbam-embedded-emissions-calculator.md)

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md), [Climate Scenario Applicator (NGFS / Fit-for-55)](./art-76-climate-scenario-applicator.md)
