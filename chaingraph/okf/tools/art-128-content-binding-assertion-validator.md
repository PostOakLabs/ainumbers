---
type: DecisionTool
title: "Content Binding Assertion Validator"
description: "Validate hard-binding (c2pa.hash.data/bmff, tamper-evident) vs soft-binding (watermark/fingerprint, survives re-encode). Confirms asset byte-hash matches claimed hard-binding hash. Emits TAMPER_EVIDENT / SOFT_BINDING_ONLY / UNBOUND verdict. Terminal stage."
resource: https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html
tags: ["compliance_mandate", "wave-23", "mcp:validate_content_binding_assertion"]
timestamp: 2026-07-14
---

# Content Binding Assertion Validator

> Exports a decision via MCP `validate_content_binding_assertion` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Dual-Layer Disclosure Verifier](./art-127-dual-layer-disclosure-verifier.md)

**Feeds:** _terminal node_
