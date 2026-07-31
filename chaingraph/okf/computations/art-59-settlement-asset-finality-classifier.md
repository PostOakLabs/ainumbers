---
type: Attested Computation
title: "Settlement-Asset & Legal-Finality Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-59-settlement-asset-finality-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-59-settlement-asset-finality-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Settlement-Asset & Legal-Finality Classifier — attested computation

> §10.2 Attested Computation binding for [Settlement-Asset & Legal-Finality Classifier](../tools/art-59-settlement-asset-finality-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-59-settlement-asset-finality-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f03969b8c19acf958fd9f90055c4580aa2432c04700b20a42156fa57473ace45` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
