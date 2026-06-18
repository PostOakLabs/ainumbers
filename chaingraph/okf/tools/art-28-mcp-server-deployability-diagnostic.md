---
type: DecisionTool
title: "MCP Server Deployability Diagnostic"
description: "12-question scored diagnostic: graded A–F across tool definitions & schemas, transport & auth, security hygiene, and operations. Single-node ChainGraph (chain_depth: 0). Promoted from guides/mcp-server-deployability-diagnostic.html."
resource: https://ainumbers.co/chaingraph/art-28-mcp-server-deployability-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-A", "mcp:run_mcp_deployability_diagnostic"]
timestamp: 2026-06-18T14:43:45.819Z
---

# MCP Server Deployability Diagnostic

> Exports a decision via MCP `run_mcp_deployability_diagnostic` — mandate type `agent_guardrail_mandate`.

**Context:** Wave A diagnostic — MCP server deployability

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-28-mcp-server-deployability-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** `art-18-mcp-developer-readiness-scorecard` _(not live)_
