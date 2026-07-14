---
type: DecisionTool
title: "Content Credential Signature Verifier"
description: "Verify the COSE_Sign1 claim signature against a caller-supplied signer public key using crypto.subtle.verify (Ed25519/ES256/ES384/PS256). Trust-anchor membership, cert validity window, and revocation status are caller-supplied policy inputs: zero network, no OCSP. Emits ACCEPT or REFUSE verdict."
resource: https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.html
tags: ["compliance_mandate", "wave-23", "mcp:verify_content_credential_signature"]
timestamp: 2026-07-14
---

# Content Credential Signature Verifier

> Exports a decision via MCP `verify_content_credential_signature` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [C2PA Content Credential Manifest Validator](./art-123-c2pa-manifest-validator.md)

**Feeds:** [Provenance Ingredient Tree Resolver](./art-125-provenance-ingredient-tree-resolver.md)
