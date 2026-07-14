---
type: DecisionTool
title: "MCP Authorization Metadata Validator (RFC 9728)"
description: "Validate OAuth 2.0 Protected Resource Metadata per RFC 9728: resource URI (https-scheme), non-empty authorization_servers, scopes_supported, and bearer_methods_supported restricted to header/body/query. Flags each missing or malformed member. Consumes server identity verdict (art-147), feeds registry entry conformance check (art-149). Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-148-mcp-authorization-metadata-validator.html
tags: ["compliance_mandate", "wave-27", "mcp:validate_mcp_authorization_metadata"]
timestamp: 2026-07-14
---

# MCP Authorization Metadata Validator (RFC 9728)

> Exports a decision via MCP `validate_mcp_authorization_metadata` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-148-mcp-authorization-metadata-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [MCP Server Identity Attestation Validator](./art-147-mcp-server-identity-attestation-validator.md)

**Feeds:** [MCP Registry Entry Conformance Checker](./art-149-mcp-registry-entry-conformance.md)
