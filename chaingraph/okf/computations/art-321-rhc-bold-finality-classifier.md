---
type: Attested Computation
title: "BoLD Challenge-Window Finality Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_finality_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-321-rhc-bold-finality-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-321-rhc-bold-finality-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# BoLD Challenge-Window Finality Classifier — attested computation

> §10.2 Attested Computation binding for [BoLD Challenge-Window Finality Classifier](../tools/art-321-rhc-bold-finality-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-321-rhc-bold-finality-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:843562f81f65f23041c7aed365bb1e7119591065931b82e37682c2ad6489ea93` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
