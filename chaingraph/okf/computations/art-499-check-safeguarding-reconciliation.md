---
type: Attested Computation
title: "CASS 15 Safeguarding Reconciliation Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-499-check-safeguarding-reconciliation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-499-check-safeguarding-reconciliation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CASS 15 Safeguarding Reconciliation Check — attested computation

> §10.2 Attested Computation binding for [CASS 15 Safeguarding Reconciliation Check](../tools/art-499-check-safeguarding-reconciliation.md).

## Executor

Kernel source: `chaingraph/kernels/art-499-check-safeguarding-reconciliation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ee7c278f77ba168b6c221d6a703d01ad0390c884fd1551198e71f423d3fe4554` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
