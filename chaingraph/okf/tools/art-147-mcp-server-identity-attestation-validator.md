---
type: DecisionTool
title: "MCP Server Identity Attestation Validator"
description: "Validate a new-spec MCP server identity document: required claims (subject, issuer, serverInfo), well-known path correctness (/.well-known/mcp-server-identity), and attestation reference present. Caller supplies decoded document plus a signature-valid boolean: zero network, zero PII. Feeds the RFC 9728 authorization metadata validator (art-148). New MCP spec server identity check active 2025-2026."
resource: https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.html
tags: ["compliance_mandate", "wave-27", "mcp:validate_mcp_server_identity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-147-mcp-server-identity-attestation-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.html
    title: "public tool page"
---

# MCP Server Identity Attestation Validator

> Exports a decision via MCP `validate_mcp_server_identity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [MCP Authorization Metadata Validator (RFC 9728)](./art-148-mcp-authorization-metadata-validator.md)
