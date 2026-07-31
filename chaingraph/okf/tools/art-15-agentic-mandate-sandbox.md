---
type: DecisionTool
title: "Agentic Mandate Sandbox"
description: "Builds a deterministic Agent Guardrail Mandate skeleton from declared spend caps, MCC allowlist/blocklist, velocity rules, time windows, and approval thresholds. Stage 1 of the Agentic Policy Chain. The browser page additionally runs an interactive randomized synthetic-transaction simulator against the mandate for exploration; that non-deterministic step is a UI feature only and is not part of this server artifact's hashed output. Zero PII, client-side compute in the browser tool, deterministic server compute for MCP callers."
resource: https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.html
tags: ["agent_guardrail_mandate", "wave-ORPHANNODE-ONBOARD-2", "mcp:simulate_agent_spend_policy"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-15-agentic-mandate-sandbox.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.html
    title: "public tool page"
---

# Agentic Mandate Sandbox

> Exports a decision via MCP `simulate_agent_spend_policy` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agentic Payments Readiness Diagnostic](./art-27-agentic-readiness-diagnostic.md)

**Feeds:** [Google AP2 Mandate Builder](./art-16-google-ap2-mandate-builder.md)

## Attested computation

[executor + attester binding](../computations/art-15-agentic-mandate-sandbox.md) — §10.2.
