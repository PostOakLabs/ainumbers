---
type: DecisionTool
title: "EUDR Commodity Scope Classifier"
description: "Classify an HS code against EUDR Annex I to determine commodity scope (cattle, cocoa, coffee, oil palm, rubber, soya, wood, or out-of-scope), operator/trader role, SME status, DDS filing obligation, and enforcement deadline (large/medium 2026-12-30; micro/SME 2027-06-30). Returns obligations list and geo-exemption eligibility. Terminal node of the eudr-due-diligence-statement-validation chain. Zero network, zero PII. Reg. EU 2023/1115."
resource: https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.html
tags: ["compliance_mandate", "wave-30", "mcp:classify_eudr_commodity_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-167-eudr-commodity-scope-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.html
    title: "public tool page"
---

# EUDR Commodity Scope Classifier

> Exports a decision via MCP `classify_eudr_commodity_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EUDR Geolocation Plot Validator](./art-166-eudr-geolocation-plot-validator.md)

**Feeds:** _terminal node_
