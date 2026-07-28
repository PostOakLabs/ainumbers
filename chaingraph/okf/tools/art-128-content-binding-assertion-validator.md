---
type: DecisionTool
title: "Content Binding Assertion Validator"
description: "Validate hard-binding (c2pa.hash.data/bmff, tamper-evident) vs soft-binding (watermark/fingerprint, survives re-encode). Confirms asset byte-hash matches claimed hard-binding hash. Emits TAMPER_EVIDENT / SOFT_BINDING_ONLY / UNBOUND verdict. Terminal stage."
resource: https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html
tags: ["compliance_mandate", "wave-23", "mcp:validate_content_binding_assertion"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-128-content-binding-assertion-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html
    title: "public tool page"
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

## Attested computation

[executor + attester binding](../computations/art-128-content-binding-assertion-validator.md) — §10.2.
