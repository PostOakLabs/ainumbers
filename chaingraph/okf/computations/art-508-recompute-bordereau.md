---
type: Attested Computation
title: "Delegated Authority Bordereau Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-508-recompute-bordereau.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-508-recompute-bordereau.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Delegated Authority Bordereau Recomputation — attested computation

> §10.2 Attested Computation binding for [Delegated Authority Bordereau Recomputation](../tools/art-508-recompute-bordereau.md).

## Executor

Kernel source: `chaingraph/kernels/art-508-recompute-bordereau.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:400131baae5bef4da3dcb65a389b7eae6ef0e310ab7d91747a5a89bb26666102` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
