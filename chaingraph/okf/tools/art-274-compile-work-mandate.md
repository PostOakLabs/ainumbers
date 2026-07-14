---
type: DecisionTool
title: "Work Mandate Compiler"
description: "Compiles a §22 Work Mandate document into a deterministic §21.4 gated-chain config. Transforms scope.tool_ids (or scope.chains) into an ordered steps[] skeleton, maps conditions into gate rules (op/value/next), and maps escalation_triggers into rules whose next routes to the reserved 'escalate' target (§22.3). All conditions and triggers must share one RFC 6901 pointer per §22.4 Rule 2; multi-pointer policies are rejected with error:'multi_pointer_gate'. Default for every gate is 'escalate'. Same mandate always produces byte-identical config (deterministic, hash-stable). Not a payment-mandate builder, not an audit-mandate tool, not an agent-OBO validator -- this compiles a policy mandate into an enforceable gated-chain config. Zero PII: structural mandate fields only."
resource: https://ainumbers.co/chaingraph/art-274-compile-work-mandate.html
tags: ["governance_mandate", "wave-47", "mcp:compile_work_mandate"]
timestamp: 2026-07-14
---

# Work Mandate Compiler

> Exports a decision via MCP `compile_work_mandate` — mandate type `governance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-274-compile-work-mandate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
