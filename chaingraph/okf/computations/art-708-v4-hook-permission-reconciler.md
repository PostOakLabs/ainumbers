---
type: Attested Computation
title: "V4 Hook Permission Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-708-v4-hook-permission-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-708-v4-hook-permission-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# V4 Hook Permission Reconciler — attested computation

> §10.2 Attested Computation binding for [V4 Hook Permission Reconciler](../tools/art-708-v4-hook-permission-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/art-708-v4-hook-permission-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e08cd99eaa433bc5d34fddce29b5bc96932043799b00ecc03f90b6e8670d25e9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
