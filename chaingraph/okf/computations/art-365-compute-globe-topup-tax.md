---
type: Attested Computation
title: "GloBE Top-Up Tax & QDMTT Allocation Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-365-compute-globe-topup-tax.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-365-compute-globe-topup-tax.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Top-Up Tax & QDMTT Allocation Calculator — attested computation

> §10.2 Attested Computation binding for [GloBE Top-Up Tax & QDMTT Allocation Calculator](../tools/art-365-compute-globe-topup-tax.md).

## Executor

Kernel source: `chaingraph/kernels/art-365-compute-globe-topup-tax.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:13a6650112aa3c9d98d82f8b01e865c13a0a80fedbda70988c9d012207a66e89` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
