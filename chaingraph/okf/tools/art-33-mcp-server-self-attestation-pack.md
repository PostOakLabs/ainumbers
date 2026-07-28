---
type: DecisionTool
title: "MCP Server Self-Attestation Pack"
description: "Combines the five MCP-dev checks: tool-definition lint (JSON Schema 2020-12), server.json validation (2025-12-11 schema), OAuth 2.1 audit (RFC 9728 PRM, RFC 8707 audience), tool-poisoning scan, and ops/readiness, into one signed attestation: composite A-F ship-readiness grade + per-domain scores + ordered remediation. Dogfooding: the AINumbers server can attest itself."
resource: https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.html
tags: ["infrastructure_mandate", "wave-6", "mcp:attest_mcp_server"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-33-mcp-server-self-attestation-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.html
    title: "public tool page"
---

# MCP Server Self-Attestation Pack

> Exports a decision via MCP `attest_mcp_server` — mandate type `infrastructure_mandate`.

**Context:** MCP 2026-07-28 spec hardening makes server attestation a live need.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
