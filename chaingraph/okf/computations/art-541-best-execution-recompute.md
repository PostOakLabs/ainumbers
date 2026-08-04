---
type: Attested Computation
title: "Best-Execution NBBO Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-541-best-execution-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-541-best-execution-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Best-Execution NBBO Recompute — attested computation

> §10.2 Attested Computation binding for [Best-Execution NBBO Recompute](../tools/art-541-best-execution-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-541-best-execution-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3fe3f8f91aee95249b6c690837eac8476621b70688946d1417dda593e4c1915c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
