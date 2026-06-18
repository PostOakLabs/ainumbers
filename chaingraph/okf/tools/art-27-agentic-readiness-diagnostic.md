---
type: DecisionTool
title: "Agentic Payments Readiness Diagnostic"
description: "12-question scored diagnostic: graded A–F across policy & mandates, protocol formalisation, financial-crime controls, and MCP runtime operations. Single-node ChainGraph (chain_depth: 0). Promoted from guides/agentic-readiness-diagnostic.html."
resource: https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-A", "mcp:run_agentic_readiness_diagnostic"]
timestamp: 2026-06-18T15:18:23.408Z
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

**Feeds:** `art-15-agentic-mandate-sandbox` _(not live)_, `art-16-google-ap2-mandate-builder` _(not live)_, `art-17-ap2-mcp-policy-validator` _(not live)_, `art-18-mcp-developer-readiness-scorecard` _(not live)_
