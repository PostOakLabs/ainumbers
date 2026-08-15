---
type: Attested Computation
title: "AP2 CartMandate Hash-Chain Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the payment_policy decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-595-ap2-cartmandate-hashchain-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-595-ap2-cartmandate-hashchain-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP2 CartMandate Hash-Chain Builder — attested computation

> §10.2 Attested Computation binding for [AP2 CartMandate Hash-Chain Builder](../tools/art-595-ap2-cartmandate-hashchain-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-595-ap2-cartmandate-hashchain-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b0b1ed06bbeb16d1227f7073af8e46c323bff835b503b0d2f3a7231baa44803e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
