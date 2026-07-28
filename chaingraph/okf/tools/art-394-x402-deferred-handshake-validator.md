---
type: DecisionTool
title: "x402 Deferred-Scheme Handshake Validator"
description: "Validates a Cloudflare `deferred` x402 scheme handshake: 402 offer field shape (scheme:\"deferred\", id, termsUrl), RFC 9421 HTTP Message Signature covered-component coverage (@method, @target-uri, content-digest), and settlement-reference id continuity across a call sequence (uniqueness, no internal duplicates). Cryptographic signature verification reuses verify_webbotauth_signature (art-129); rollup/batch settlement arithmetic is owned by reconcile_x402_batch_settlement (art-61); this node validates the offer and handshake shape only. Scheme registry is a plugin surface and is not hard-coded."
resource: https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.html
tags: ["compliance_control", "wave-66", "mcp:validate_x402_deferred_handshake"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-394-x402-deferred-handshake-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.html
    title: "public tool page"
---

# x402 Deferred-Scheme Handshake Validator

> Exports a decision via MCP `validate_x402_deferred_handshake` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [x402 v2 Wire-Format Migration Linter](./art-393-x402-v2-migration-linter.md), [Web Bot Auth Signature Verifier (RFC 9421)](./art-129-webbotauth-signature-verifier.md)

**Feeds:** [x402 V2 Batch-Settlement Reconciler](./art-61-x402-batch-settlement-reconciler.md)
