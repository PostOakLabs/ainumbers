---
type: Attested Computation
title: "Crypto-Asset Whitepaper Linter (iXBRL) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-102-crypto-asset-whitepaper-linter.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-102-crypto-asset-whitepaper-linter.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Crypto-Asset Whitepaper Linter (iXBRL) — attested computation

> §10.2 Attested Computation binding for [Crypto-Asset Whitepaper Linter (iXBRL)](../tools/art-102-crypto-asset-whitepaper-linter.md).

## Executor

Kernel source: `chaingraph/kernels/art-102-crypto-asset-whitepaper-linter.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0d1c9a8705e0308f72420985fe902d83fa6bf9181650ec1939bfcc4d60dfd150` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
