---
type: DecisionTool
title: "MCP Registry Entry Conformance Checker"
description: "Validate an MCP Registry server.json entry: $schema present, reverse-DNS name format (namespace/name), semver version, and at least one of packages or remotes populated. Terminal stage of the mcp-server-governance-conformance chain. Exports governance attestation with execution_hash. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.html
tags: ["compliance_mandate", "wave-27", "mcp:check_mcp_registry_entry"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-149-mcp-registry-entry-conformance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.html
    title: "public tool page"
---

# MCP Registry Entry Conformance Checker

> Exports a decision via MCP `check_mcp_registry_entry` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MCP Authorization Metadata Validator (RFC 9728)](./art-148-mcp-authorization-metadata-validator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-149-mcp-registry-entry-conformance.md) — §10.2.
