---
type: DecisionTool
title: "KYA Credential x x402 Payload Scope Verifier"
description: "Cross-checks a declared KYA (Know Your Agent) credential's scope against a declared x402 PaymentPayload: amount vs the credential's spend cap, network/asset vs its allowed set, payee vs its merchant allowlist, validity window vs the payload's timestamps, and scope-string coverage of the payment scheme. Returns findings[] and a verdict of IN_SCOPE, OUT_OF_SCOPE, or INDETERMINATE (when the credential omits a claim the payload requires -- never guessed). Verify-only: never fetches either input, never contacts Skyfire or a facilitator, performs no signature verification, and never initiates or settles an x402 payment."
resource: https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.html
tags: ["compliance_mandate", "wave-92", "mcp:verify_kya_x402_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-565-kya-x402-scope-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.html
    title: "public tool page"
---

# KYA Credential x x402 Payload Scope Verifier

> Exports a decision via MCP `verify_kya_x402_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-565-kya-x402-scope-verifier.md) — §10.2.
