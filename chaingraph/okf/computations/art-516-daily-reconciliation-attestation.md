---
type: Attested Computation
title: "Daily Reconciliation Attestation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-516-daily-reconciliation-attestation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-516-daily-reconciliation-attestation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Daily Reconciliation Attestation — attested computation

> §10.2 Attested Computation binding for [Daily Reconciliation Attestation](../tools/art-516-daily-reconciliation-attestation.md).

## Executor

Kernel source: `chaingraph/kernels/art-516-daily-reconciliation-attestation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cd7f7a7436413bdff06e19d14156760a6a8401f9e48a936fa26a9e3b60b6a3d8` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
