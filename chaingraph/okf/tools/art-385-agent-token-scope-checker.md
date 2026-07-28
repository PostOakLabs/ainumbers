---
type: DecisionTool
title: "Agent Token Scope Checker"
description: "Compares a requested agent action (amount, currency, merchant category, timestamp) against an agent token or mandate's declared scope: spend cap, currency, MCC allow-list, and expiry. If an attenuation chain of ancestor tokens is supplied, also checks that each delegation link narrows -- never widens -- the parent's bounds. Returns an in-scope or out-of-scope verdict and receipt. Pure evaluation only -- never authorizes, blocks, or executes a payment. Consumes the same mandate-chain vocabulary as art-01; distinct job -- one requested action against one token's bounds, not full mandate-chain structural validation."
resource: https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.html
tags: ["compliance_mandate", "wave-47", "mcp:check_agent_token_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-385-agent-token-scope-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.html
    title: "public tool page"
---

# Agent Token Scope Checker

> Exports a decision via MCP `check_agent_token_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
