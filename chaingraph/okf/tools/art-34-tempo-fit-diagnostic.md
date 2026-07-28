---
type: DecisionTool
title: "Tempo Fit Diagnostic"
description: "12-question A–F diagnostic grading an organisation's Tempo adoption fit across four dimensions: Issue (TIP-20/GENIUS PPSI), Payments (cost wedge), Agent (MPP/HTTP 402), Commerce (agentic checkout). Routing engine maps score profile to the correct chain. OCG v0.3.1 artifact; dct:conformsTo party-identification.jsonld."
resource: https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-9", "mcp:run_tempo_fit_diagnostic"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-34-tempo-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.html
    title: "public tool page"
---

# Tempo Fit Diagnostic

> Exports a decision via MCP `run_tempo_fit_diagnostic` — mandate type `agent_guardrail_mandate`.

**Context:** Tempo mainnet live March 2026; GENIUS Act enacted; MPP open standard live March 2026.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Tempo Payments Business Case](./art-35-tempo-payments-business-case.md), [Tempo MPP Agent Mandate](./art-36-tempo-mpp-agent-mandate.md), [Tempo Stablecoin Issuance Compliance](./art-37-tempo-stablecoin-issuance.md), [Tempo Agentic Checkout Settlement Mapper](./art-40-tempo-agentic-checkout.md)
