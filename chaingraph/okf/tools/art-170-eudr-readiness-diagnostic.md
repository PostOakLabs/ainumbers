---
type: DecisionTool
title: "EUDR Readiness Diagnostic"
description: "A-F EUDR readiness diagnostic across six dimensions: scope mapping, geolocation data quality, DDS submission readiness (TRACES NT), country risk assessment, risk mitigation documentation, and 5-year retention system. Returns readiness_grade (A-F), readiness_score (0-100), gaps list, and dual enforcement deadlines (large/medium 2026-12-30; micro/SME 2027-06-30). Terminal node of the eudr-supply-chain-risk-and-traceability chain. Zero network, zero PII. Reg. EU 2023/1115."
resource: https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.html
tags: ["compliance_mandate", "wave-30", "mcp:run_eudr_readiness_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-170-eudr-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.html
    title: "public tool page"
---

# EUDR Readiness Diagnostic

> Exports a decision via MCP `run_eudr_readiness_fit` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EUDR Supply-Chain Traceability Linker](./art-169-eudr-supply-chain-traceability-linker.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-170-eudr-readiness-diagnostic.md) — §10.2.
