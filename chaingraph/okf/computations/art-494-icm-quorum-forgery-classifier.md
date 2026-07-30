---
type: Attested Computation
title: "ICM Quorum Forgery Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-494-icm-quorum-forgery-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-494-icm-quorum-forgery-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ICM Quorum Forgery Classifier — attested computation

> §10.2 Attested Computation binding for [ICM Quorum Forgery Classifier](../tools/art-494-icm-quorum-forgery-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-494-icm-quorum-forgery-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5d1204c5f516f5975687ac3d86c9f9325f1fbac2071cfebf14f55f33094d7c7f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
