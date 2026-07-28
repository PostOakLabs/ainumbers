---
type: DecisionTool
title: "Agent On-Behalf-Of (OBO) Mandate Validator"
description: "Validate an agent on-behalf-of (OBO) mandate: subject (the user being represented), bounded scope array, intent string, and a non-expired validity window (caller-supplied now_unix, no clock reads). Mismatch or expiry returns REFUSE. Aligns with the AP2 mandate-chain pattern (art-01). Consumes scope-revocation audit (art-150), feeds task lifecycle validator (art-152). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.html
tags: ["compliance_mandate", "wave-27", "mcp:validate_agent_obo_mandate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-151-agent-obo-mandate-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.html
    title: "public tool page"
---

# Agent On-Behalf-Of (OBO) Mandate Validator

> Exports a decision via MCP `validate_agent_obo_mandate` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MCP Tool Scope & Revocation Auditor](./art-150-mcp-tool-scope-revocation-auditor.md)

**Feeds:** [MCP Task Lifecycle State Machine Validator](./art-152-mcp-task-lifecycle-validator.md)

## Attested computation

[executor + attester binding](../computations/art-151-agent-obo-mandate-validator.md) — §10.2.
