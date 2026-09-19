---
type: DecisionTool
title: "CBAM Certificate Cost & Free-Allocation Engine"
description: "Converts embedded emissions into a CBAM certificate liability: screens the 50 tonne mass-based de minimis exemption, applies the CBAM factor (free-allocation phase-out 2.5% 2026 to 100% 2034), deducts origin carbon price already paid, prices 2026-vintage certificates at the quarterly average of the quarter of importation and later vintages at the weekly closing average, and projects the quarterly holding and surrender schedule to the 30 Sep deadline. The quarterly minimum holding is year-keyed: 50% of embedded emissions imported since the start of the calendar year, in force from 1 January 2027 only, with a one-quarter grace after the mass threshold is exceeded. Certificate sales begin 1 February 2027. Not modelled, and named in the omnibus_out_of_scope output field: the repurchase limit rewrite, the 2026-vintage repurchase window, and the certificate cancellation regime. The CBAM factor ramp is unaffected by Reg. (EU) 2025/2083 and is carried forward unchanged."
resource: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html
tags: ["compliance_mandate", "wave-16", "mcp:model_cbam_certificate_cost"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-71-cbam-certificate-cost-engine.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html
    title: "public tool page"
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

## Attested computation

[executor + attester binding](../computations/art-71-cbam-certificate-cost-engine.md) — §10.2.
