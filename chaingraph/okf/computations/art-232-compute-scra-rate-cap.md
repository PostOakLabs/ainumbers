---
type: Attested Computation
title: "Compute SCRA Rate Cap — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-232-compute-scra-rate-cap.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-232-compute-scra-rate-cap.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Compute SCRA Rate Cap — attested computation

> §10.2 Attested Computation binding for [Compute SCRA Rate Cap](../tools/art-232-compute-scra-rate-cap.md).

## Executor

Kernel source: `chaingraph/kernels/art-232-compute-scra-rate-cap.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0a3d8bc33a4d50ca92a1673b6b23e5bcb483ad80dc375dfba12094440fc0d32d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
