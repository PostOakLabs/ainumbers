---
type: DecisionTool
title: "Agent-Traffic Acceptance Policy Builder"
description: "Builds a policy mandate governing accepted AI agent types, identity verification level, velocity and value caps, payment rails, refund posture, retry policy, and blocking rules. Exports an agent-readable instructions block and a §4 hash-anchored artifact. Node 3 of 3 in the Agentic Checkout Chain."
resource: https://ainumbers.co/chaingraph/art-21-agent-traffic-acceptance-policy-builder.html
tags: ["agent_guardrail_mandate", "wave-A", "mcp:build_agent_traffic_policy"]
timestamp: 2026-07-14
---

# Agent-Traffic Acceptance Policy Builder

> Exports a decision via MCP `build_agent_traffic_policy` — mandate type `agent_guardrail_mandate`.

**Context:** ACP/AP2/EU AI Act Art.13/14 transparency + oversight obligations

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-21-agent-traffic-acceptance-policy-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ACP/UCP Product-Feed Conformance Auditor](./art-20-acp-ucp-product-feed-conformance-auditor.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
