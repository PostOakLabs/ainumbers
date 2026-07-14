---
type: DecisionTool
title: "FRIA & Post-Market Monitoring Plan Builder"
description: "Builds an Art 27 Fundamental Rights Impact Assessment (FRIA) + Art 72 post-market monitoring plan + Art 12 logging + Art 14 human-oversight design + Art 73 serious-incident reporting path for a bank or insurer deploying a high-risk AI system. Prepare-ahead: 2 Dec 2027 (verify Digital Omnibus). Decision-support draft."
resource: https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.html
tags: ["compliance_mandate", "wave-15", "mcp:build_fria_monitoring_plan"]
timestamp: 2026-07-14
---

# FRIA & Post-Market Monitoring Plan Builder

> Exports a decision via MCP `build_fria_monitoring_plan` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act High-Risk Fit & Classification Diagnostic](./art-64-ai-act-highrisk-fit-diagnostic.md)

**Feeds:** `451-sr11-7-model-risk-management-gap-assessor` _(not live)_, [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
