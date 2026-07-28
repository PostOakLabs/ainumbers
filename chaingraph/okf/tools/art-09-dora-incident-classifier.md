---
type: DecisionTool
title: "DORA Major-Incident Reporting Threshold Classifier"
description: "DORA Article 19/20 reporting determination and reporting-clock start. Clients affected, transaction value, downtime, geographic spread, cross-border component. Fast, deterministic."
resource: https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.html
tags: ["infrastructure_mandate", "wave-1", "mcp:classify_dora_incident"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-09-dora-incident-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.html
    title: "public tool page"
---

# DORA Major-Incident Reporting Threshold Classifier

> Exports a decision via MCP `classify_dora_incident` — mandate type `infrastructure_mandate`.

**Context:** DORA (EU) 2022/2554 in force January 2025

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [DORA Readiness Diagnostic](./art-29-dora-readiness-diagnostic.md)

**Feeds:** [DORA ICT Cascade Simulator](./pnr-01-dora-ict-cascade-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-09-dora-incident-classifier.md) — §10.2.
