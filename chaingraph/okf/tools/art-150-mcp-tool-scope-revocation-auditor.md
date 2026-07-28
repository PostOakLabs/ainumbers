---
type: DecisionTool
title: "MCP Tool Scope & Revocation Auditor"
description: "Audit scoped and revocable MCP tool access per the new MCP specification: each granted tool must carry an explicit scope array, a revocation endpoint must be configured (https-scheme), and token rotation posture (max age vs elapsed time, next-key presence) must be healthy. Emits per-tool grant verdict and gap list. Feeds the on-behalf-of mandate validator (art-151). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.html
tags: ["compliance_mandate", "wave-27", "mcp:audit_mcp_tool_scope_revocation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-150-mcp-tool-scope-revocation-auditor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.html
    title: "public tool page"
---

# MCP Tool Scope & Revocation Auditor

> Exports a decision via MCP `audit_mcp_tool_scope_revocation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent On-Behalf-Of (OBO) Mandate Validator](./art-151-agent-obo-mandate-validator.md)

## Attested computation

[executor + attester binding](../computations/art-150-mcp-tool-scope-revocation-auditor.md) — §10.2.
