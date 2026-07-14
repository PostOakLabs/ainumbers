---
type: DecisionTool
title: "Agent Payment Rail Trust Crosswalk"
description: "Crosswalk agent identity posture (alg, directory published, card present, signature verified) to Visa TAP, Mastercard Agent Pay, and Web Bot Auth acceptance criteria. Emits per-rail accepted/gaps. Consumes art-132, feeds art-134."
resource: https://ainumbers.co/chaingraph/art-133-agent-payment-rail-trust-crosswalk.html
tags: ["compliance_mandate", "wave-24", "mcp:crosswalk_agent_payment_rail_trust"]
timestamp: 2026-07-14
---

# Agent Payment Rail Trust Crosswalk

> Exports a decision via MCP `crosswalk_agent_payment_rail_trust` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-133-agent-payment-rail-trust-crosswalk.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Key Rotation Auditor](./art-132-agent-key-rotation-auditor.md)

**Feeds:** [Agent Directory Publish Readiness Diagnostic](./art-134-agent-directory-publish-readiness.md)
