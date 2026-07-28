---
type: Attested Computation
title: "GloBE SBIE & Top-up Tax Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-455-globe-sbie-topup.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-455-globe-sbie-topup.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE SBIE & Top-up Tax Calculator — attested computation

> §10.2 Attested Computation binding for [GloBE SBIE & Top-up Tax Calculator](../tools/art-455-globe-sbie-topup.md).

## Executor

Kernel source: `chaingraph/kernels/art-455-globe-sbie-topup.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f883e9af5be1a09cf3f90e6d98b8452905bbef712f381adef50876f7ee4a44ab` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
