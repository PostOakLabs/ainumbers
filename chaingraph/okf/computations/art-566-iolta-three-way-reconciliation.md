---
type: Attested Computation
title: "IOLTA Three-Way Trust Reconciliation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-566-iolta-three-way-reconciliation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-566-iolta-three-way-reconciliation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IOLTA Three-Way Trust Reconciliation — attested computation

> §10.2 Attested Computation binding for [IOLTA Three-Way Trust Reconciliation](../tools/art-566-iolta-three-way-reconciliation.md).

## Executor

Kernel source: `chaingraph/kernels/art-566-iolta-three-way-reconciliation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:891bee3fc15ad70e6efb5440b1b794536e846e9bb77b5a4a9ea06df0153f772a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
