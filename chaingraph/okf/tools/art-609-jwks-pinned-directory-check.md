---
type: DecisionTool
title: "JWKS Pinned-Directory Check"
description: "Confirm a caller-supplied JWKS directory document matches a caller-pinned SHA-256 digest (sha256(canonicalize(directory_jwks)) === pinned_digest) before art-130 trusts its shape. Zero network, zero key hosting -- both the document and the digest are caller-supplied. Chains before art-130 in visa-tap-agent-verification."
resource: https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.html
tags: ["compliance_control", "wave-100", "mcp:check_jwks_pinned_directory"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-609-jwks-pinned-directory-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.html
    title: "public tool page"
---

# JWKS Pinned-Directory Check

> Exports a decision via MCP `check_jwks_pinned_directory` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Web Bot Auth Signature Verifier (RFC 9421)](./art-129-webbotauth-signature-verifier.md)

**Feeds:** [HTTP Signatures Directory Validator](./art-130-signature-directory-validator.md)

## Attested computation

[executor + attester binding](../computations/art-609-jwks-pinned-directory-check.md) — §10.2.
