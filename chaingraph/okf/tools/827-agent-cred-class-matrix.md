---
type: DecisionTool
title: "Agent Cred Class Matrix"
description: "Maps five agent payment credential classes (shared payment token, network agentic token, API-key card proxy, x402 EIP-3009 permit, wallet delegated session key) across scope, expiry, replay protection, revocability and what the agent can learn. Scope, expiry and replay cells chain to sibling verdicts; revocability and learn are declared facts from closed vocabularies. Columns no cited source settles are marked unpinned and flagged for review."
resource: https://ainumbers.co/chaingraph/827-agent-cred-class-matrix.html
tags: ["compliance_mandate", "wave-142", "mcp:compute_agent_cred_matrix"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/827-agent-cred-class-matrix.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/827-agent-cred-class-matrix.html
    title: "public tool page"
---

# Agent Cred Class Matrix

> Exports a decision via MCP `compute_agent_cred_matrix` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/827-agent-cred-class-matrix.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Payment Rail Trust Crosswalk](./art-133-agent-payment-rail-trust-crosswalk.md), [Agent Token Scope Checker](./art-385-agent-token-scope-checker.md), [X402 Permit2 Evidence Recomputer](./art-699-x402-permit2-evidence-recomputer.md), [Mandate Authorization Gate](./art-703-mandate-authorization-gate.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/827-agent-cred-class-matrix.md) — §10.2.
