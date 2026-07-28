---
type: DecisionTool
title: "Signature Agent Card Validator"
description: "Validate the Signature Agent Card (Cloudflare/Bedrock AgentCore schema): required fields (name, operator, expected request rate, keys) and card keys consistent with the validated directory. Emits identity-trust verdict. Terminal stage of agent-identity-verification chain."
resource: https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.html
tags: ["compliance_mandate", "wave-24", "mcp:validate_signature_agent_card"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-131-signature-agent-card-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.html
    title: "public tool page"
---

# Signature Agent Card Validator

> Exports a decision via MCP `validate_signature_agent_card` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [HTTP Signatures Directory Validator](./art-130-signature-directory-validator.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-131-signature-agent-card-validator.md) — §10.2.
