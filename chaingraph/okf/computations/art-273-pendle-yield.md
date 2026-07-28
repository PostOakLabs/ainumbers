---
type: Attested Computation
title: "Pendle Yield Tokenization Analyzer (PT/YT) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-273-pendle-yield.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-273-pendle-yield.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Pendle Yield Tokenization Analyzer (PT/YT) — attested computation

> §10.2 Attested Computation binding for [Pendle Yield Tokenization Analyzer (PT/YT)](../tools/art-273-pendle-yield.md).

## Executor

Kernel source: `chaingraph/kernels/art-273-pendle-yield.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:11142b24e8baee3beb0ab8ef15ab1c5ddc7fbe07ad7b5b63b7d81d66ff289439` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
