---
type: Attested Computation
title: "PFMI proportional self-assessment scorer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-790-assess-pfmi-proportional.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-790-assess-pfmi-proportional.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# PFMI proportional self-assessment scorer — attested computation

> §10.2 Attested Computation binding for [PFMI proportional self-assessment scorer](../tools/art-790-assess-pfmi-proportional.md).

## Executor

Kernel source: `chaingraph/kernels/art-790-assess-pfmi-proportional.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:00d564c9c369cdd611a00c16afecbc240ca85c41bb780b72ad39d20a1ee545d0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
