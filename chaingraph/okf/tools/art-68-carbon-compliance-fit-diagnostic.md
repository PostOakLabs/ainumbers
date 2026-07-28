---
type: DecisionTool
title: "Carbon & Climate Compliance Fit Diagnostic"
description: "12-question A-F diagnostic that classifies which carbon/climate obligations bind a firm (CBAM authorised-declarant duty, EU Taxonomy alignment, EU Green Bond conformance, climate stress) and routes to the right carbon-compliance chain. Separates in-force CBAM definitive liability (since 1 Jan 2026) from prepare-ahead items (first declaration 30 Sep 2027, downstream scope 1 Jan 2028)."
resource: https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-16", "mcp:run_carbon_compliance_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-68-carbon-compliance-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.html
    title: "public tool page"
---

# Carbon & Climate Compliance Fit Diagnostic

> Exports a decision via MCP `run_carbon_compliance_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [CBAM Embedded-Emissions Calculator](./art-69-cbam-embedded-emissions-calculator.md), [CBAM Precursor-Emissions Aggregator](./art-72-cbam-precursor-emissions-aggregator.md), [EU Taxonomy Alignment Scorer](./art-73-taxonomy-alignment-scorer.md), [EU Green Bond Factsheet & Allocation Validator](./art-75-eugb-factsheet-validator.md), [Climate Scenario Applicator (NGFS / Fit-for-55)](./art-76-climate-scenario-applicator.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

## Attested computation

[executor + attester binding](../computations/art-68-carbon-compliance-fit-diagnostic.md) — §10.2.
