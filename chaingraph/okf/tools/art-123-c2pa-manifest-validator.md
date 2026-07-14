---
type: DecisionTool
title: "C2PA Content Credential Manifest Validator"
description: "Validate a decoded C2PA 2.x manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference. Feeds the Content Credential signature verifier (art-124). Underpins EU AI Act Art. 50 machine-readable marking (applies 2 Aug 2026)."
resource: https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html
tags: ["compliance_mandate", "wave-23", "mcp:validate_c2pa_manifest"]
timestamp: 2026-07-14
---

# C2PA Content Credential Manifest Validator

> Exports a decision via MCP `validate_c2pa_manifest` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Content Credential Signature Verifier](./art-124-content-credential-signature-verifier.md)
