---
type: Attested Computation
title: "Securitisation Payment Waterfall Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-509-recompute-payment-waterfall.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-509-recompute-payment-waterfall.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Securitisation Payment Waterfall Recomputation — attested computation

> §10.2 Attested Computation binding for [Securitisation Payment Waterfall Recomputation](../tools/art-509-recompute-payment-waterfall.md).

## Executor

Kernel source: `chaingraph/kernels/art-509-recompute-payment-waterfall.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:79ba683f5f9684c6c7ab2b2cfe7cdd8546591b5de200da9f10a3bb9637e408f1` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
