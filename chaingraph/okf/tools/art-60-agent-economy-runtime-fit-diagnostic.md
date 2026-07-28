---
type: DecisionTool
title: "Agent Economy Runtime Fit Diagnostic"
description: "12-question A-F readiness diagnostic for the agent-economy runtime / post-trade layer (x402 V2 batch settlement, AP2 PaymentReceipt, Human-Not-Present autonomy, reconciliation, metering, runtime fraud). Grades an agent platform/operator and routes to the right agent-economy chain."
resource: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-14", "mcp:run_agent_economy_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-60-agent-economy-runtime-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html
    title: "public tool page"
---

# Agent Economy Runtime Fit Diagnostic

> Exports a decision via MCP `run_agent_economy_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [x402 V2 Batch-Settlement Reconciler](./art-61-x402-batch-settlement-reconciler.md), [AP2 PaymentReceipt Verifier & HNP Guardrail](./art-62-ap2-payment-receipt-verifier.md), [Agent-Service Metering & Marketplace Economics Modeler](./art-63-agent-service-metering-modeler.md), [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [APP Fraud Graph Simulator](./mms-03-app-fraud-graph.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
