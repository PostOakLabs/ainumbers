---
type: DecisionTool
title: "Agent-Service Metering & Marketplace Economics Modeler"
description: "Educational unit-economics modeler for agent-service micropayment marketplaces: per-call pricing, x402 V2 batch-settlement savings, marketplace take-rate, net margin, break-even volume, and sensitivity analysis across batch sizes. Not pricing or financial advice."
resource: https://ainumbers.co/chaingraph/art-63-agent-service-metering-modeler.html
tags: ["payment_policy", "wave-14", "mcp:model_agent_service_metering"]
timestamp: 2026-07-14
---

# Agent-Service Metering & Marketplace Economics Modeler

> Exports a decision via MCP `model_agent_service_metering` — mandate type `payment_policy`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-63-agent-service-metering-modeler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Economy Runtime Fit Diagnostic](./art-60-agent-economy-runtime-fit-diagnostic.md)

**Feeds:** [x402 Settlement Cost & Finality Modeler](./art-03-x402-settlement-modeler.md), [Time-Series Anomaly Detector](./ml-03-timeseries-anomaly-detector.md)
