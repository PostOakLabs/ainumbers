---
type: DecisionTool
title: "HTTP Signatures Directory Validator"
description: "Validate the /.well-known/http-message-signatures-directory JWKS: well-formed, keys are OKP/Ed25519, the keyid from Signature-Input resolves to a key in the directory, well-known path correct. Agent fetches the directory once and passes the JSON. Consumes art-129, feeds art-131."
resource: https://ainumbers.co/chaingraph/art-130-signature-directory-validator.html
tags: ["compliance_mandate", "wave-24", "mcp:validate_signature_directory"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-130-signature-directory-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-130-signature-directory-validator.html
    title: "public tool page"
---

# HTTP Signatures Directory Validator

> Exports a decision via MCP `validate_signature_directory` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-130-signature-directory-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Web Bot Auth Signature Verifier (RFC 9421)](./art-129-webbotauth-signature-verifier.md)

**Feeds:** [Signature Agent Card Validator](./art-131-signature-agent-card-validator.md)
