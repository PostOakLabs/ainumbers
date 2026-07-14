---
type: DecisionTool
title: "Agent Key Rotation Auditor"
description: "Audit key freshness and rotation posture: key age vs max-age policy, presence of a next-key and overlap window, algorithm is Ed25519. Emits HEALTHY / ROTATION_STAGED / ACTION_REQUIRED posture. Feeds the payment-rail trust crosswalk (art-133)."
resource: https://ainumbers.co/chaingraph/art-132-agent-key-rotation-auditor.html
tags: ["compliance_mandate", "wave-24", "mcp:audit_agent_key_rotation"]
timestamp: 2026-07-14
---

# Agent Key Rotation Auditor

> Exports a decision via MCP `audit_agent_key_rotation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-132-agent-key-rotation-auditor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Payment Rail Trust Crosswalk](./art-133-agent-payment-rail-trust-crosswalk.md)
