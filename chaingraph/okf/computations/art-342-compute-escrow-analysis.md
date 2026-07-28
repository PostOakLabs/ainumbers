---
type: Attested Computation
title: "RESPA Aggregate Escrow Analysis — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-342-compute-escrow-analysis.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-342-compute-escrow-analysis.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# RESPA Aggregate Escrow Analysis — attested computation

> §10.2 Attested Computation binding for [RESPA Aggregate Escrow Analysis](../tools/art-342-compute-escrow-analysis.md).

## Executor

Kernel source: `chaingraph/kernels/art-342-compute-escrow-analysis.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e607aef8dedf929559f5a0daafd8a26ba54b900cd7d64c91ee96f5c88416aa9d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
