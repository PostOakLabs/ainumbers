---
type: DecisionTool
title: "Verify Receipt"
description: "Offline verifier for AINumbers Evidence Envelope v0.1 receipts. Given a receipt JSON, recomputes the RFC 8785 JCS signing preimage, verifies the Ed25519 (EdDSA) signature against the did:key resolved from issuer_id/signatures[].kid, checks hash-field shape (sha256:-prefixed, 64 hex chars), and, when a prior receipt is supplied, recomputes previousReceiptHash to prove the chain link. Verify-only: never issues a receipt, never contacts a transparency log or registry, never resolves a DID document over the network. Every check recomputes from the receipt's own bytes; no self-claimed hash or verdict field is trusted (SO #34)."
resource: https://ainumbers.co/chaingraph/art-652-verify-receipt.html
tags: ["compliance_control", "wave-108", "mcp:compute_verify_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-652-verify-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-652-verify-receipt.html
    title: "public tool page"
---

# Verify Receipt

> Exports a decision via MCP `compute_verify_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-652-verify-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-652-verify-receipt.md) — §10.2.
