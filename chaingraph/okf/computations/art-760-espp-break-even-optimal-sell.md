---
type: Attested Computation
title: "ESPP Break-Even & Optimal Sell — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compensation_benefits decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-760-espp-break-even-optimal-sell.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-760-espp-break-even-optimal-sell.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ESPP Break-Even & Optimal Sell — attested computation

> §10.2 Attested Computation binding for [ESPP Break-Even & Optimal Sell](../tools/art-760-espp-break-even-optimal-sell.md).

## Executor

Kernel source: `chaingraph/kernels/art-760-espp-break-even-optimal-sell.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bfdfad68ef74e4bf837405730e2352a16e0b593d907e51738f4dbccc36d7f42e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
