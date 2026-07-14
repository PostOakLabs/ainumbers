---
type: DecisionTool
title: "Agent Directory Publish Readiness Diagnostic"
description: "Diagnostic: is the operator ready to publish a verifiable Web Bot Auth identity? Checks well-known path, JWKS reachability flag, card completeness, rotation posture, Ed25519. Emits ready verdict and gap list. Terminal stage of agent-identity-publishing chain."
resource: https://ainumbers.co/chaingraph/art-134-agent-directory-publish-readiness.html
tags: ["compliance_mandate", "wave-24", "mcp:assess_agent_directory_publish_readiness"]
timestamp: 2026-07-14
---

# Agent Directory Publish Readiness Diagnostic

> Exports a decision via MCP `assess_agent_directory_publish_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-134-agent-directory-publish-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Payment Rail Trust Crosswalk](./art-133-agent-payment-rail-trust-crosswalk.md)

**Feeds:** _terminal node_
