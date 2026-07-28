---
type: Attested Computation
title: "Digital Asset Regulatory Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/510-digital-asset-regulatory-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/510-digital-asset-regulatory-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Digital Asset Regulatory Classifier — attested computation

> §10.2 Attested Computation binding for [Digital Asset Regulatory Classifier](../tools/510-digital-asset-regulatory-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/510-digital-asset-regulatory-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e70b5a1adf38189f6a6f09d6b4b0dcfaf16394beb5f30f8b397cadbb0ffa2a5f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
