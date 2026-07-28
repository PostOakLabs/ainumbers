---
type: Attested Computation
title: "ViDA Platform Deemed Supplier Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-162-vida-platform-deemed-supplier-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-162-vida-platform-deemed-supplier-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA Platform Deemed Supplier Classifier — attested computation

> §10.2 Attested Computation binding for [ViDA Platform Deemed Supplier Classifier](../tools/art-162-vida-platform-deemed-supplier-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-162-vida-platform-deemed-supplier-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:523805e9550b3f35628e46722c867689df3e80d5777a5961f2d8139922715403` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
