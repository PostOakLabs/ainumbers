---
type: DecisionTool
title: "MCP Task Lifecycle State Machine Validator"
description: "Validate that a long-running MCP task state transitions are legal per the new MCP specification state machine: working to input_required or terminal states (completed, failed, cancelled); input_required back to working or terminal. Flags each illegal jump. Terminal stage of the agent-authorization-lifecycle chain. Exports lifecycle attestation with execution_hash. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.html
tags: ["compliance_mandate", "wave-27", "mcp:validate_mcp_task_lifecycle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-152-mcp-task-lifecycle-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.html
    title: "public tool page"
---

# MCP Task Lifecycle State Machine Validator

> Exports a decision via MCP `validate_mcp_task_lifecycle` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent On-Behalf-Of (OBO) Mandate Validator](./art-151-agent-obo-mandate-validator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-152-mcp-task-lifecycle-validator.md) — §10.2.
