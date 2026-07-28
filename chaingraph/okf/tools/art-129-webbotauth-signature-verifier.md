---
type: DecisionTool
title: "Web Bot Auth Signature Verifier (RFC 9421)"
description: "Reconstruct the RFC 9421 signature base and verify the Ed25519 Web Bot Auth signature against a caller-supplied public key, zero network. Checks alg=ed25519, tag=web-bot-auth, and freshness. Feeds the signatures-directory validator (art-130)."
resource: https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html
tags: ["compliance_mandate", "wave-24", "mcp:verify_webbotauth_signature"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-129-webbotauth-signature-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html
    title: "public tool page"
---

# Web Bot Auth Signature Verifier (RFC 9421)

> Exports a decision via MCP `verify_webbotauth_signature` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [HTTP Signatures Directory Validator](./art-130-signature-directory-validator.md)
