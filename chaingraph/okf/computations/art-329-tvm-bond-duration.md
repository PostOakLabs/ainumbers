---
type: Attested Computation
title: "Bond Macaulay / Modified Duration — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-329-tvm-bond-duration.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-329-tvm-bond-duration.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Bond Macaulay / Modified Duration — attested computation

> §10.2 Attested Computation binding for [Bond Macaulay / Modified Duration](../tools/art-329-tvm-bond-duration.md).

## Executor

Kernel source: `chaingraph/kernels/art-329-tvm-bond-duration.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1a9ea550792a2f97b68467d9ee4ba5672eb14643c70df767526da61b7913d531` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
