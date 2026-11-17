---
type: Attested Computation
title: "Issuer Reserve Yield Share Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/837-issuer-yield-share.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/837-issuer-yield-share.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Issuer Reserve Yield Share Check — attested computation

> §10.2 Attested Computation binding for [Issuer Reserve Yield Share Check](../tools/837-issuer-yield-share.md).

## Executor

Kernel source: `chaingraph/kernels/837-issuer-yield-share.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:32a5df7a7d778940d00ca00119638af45db6f188e16f110b05fbe43e3d9c8d32` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
