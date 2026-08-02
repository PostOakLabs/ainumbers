---
type: Attested Computation
title: "AI Training-Data Lineage Record — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-452-build-ai-training-data-lineage-record.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-452-build-ai-training-data-lineage-record.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AI Training-Data Lineage Record — attested computation

> §10.2 Attested Computation binding for [AI Training-Data Lineage Record](../tools/art-452-build-ai-training-data-lineage-record.md).

## Executor

Kernel source: `chaingraph/kernels/art-452-build-ai-training-data-lineage-record.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fd23920a354af2d91e43fa946991d108f2d99c7a9565ba3dbca922aba445e5ad` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
