---
type: DecisionTool
title: "Agentic Payments Readiness Diagnostic"
description: "12-question scored diagnostic: graded A–F across policy & mandates, protocol formalisation, financial-crime controls, and MCP runtime operations. Single-node ChainGraph (chain_depth: 0). Promoted from guides/agentic-readiness-diagnostic.html."
resource: https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-A", "mcp:run_agentic_readiness_diagnostic"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-27-agentic-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html
    title: "public tool page"
---

# Agentic Payments Readiness Diagnostic

> Exports a decision via MCP `run_agentic_readiness_diagnostic` — mandate type `agent_guardrail_mandate`.

**Context:** Wave A diagnostic — agentic payment readiness

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-27-agentic-readiness-diagnostic.md) — §10.2.
