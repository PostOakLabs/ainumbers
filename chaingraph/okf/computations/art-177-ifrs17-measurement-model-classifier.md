---
type: Attested Computation
title: "IFRS 17 Measurement Model Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-177-ifrs17-measurement-model-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-177-ifrs17-measurement-model-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IFRS 17 Measurement Model Classifier — attested computation

> §10.2 Attested Computation binding for [IFRS 17 Measurement Model Classifier](../tools/art-177-ifrs17-measurement-model-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-177-ifrs17-measurement-model-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:722f77361c37a5635fe5deb2077fcc3faccb5ec84a872dc0cdbfebc3027e0037` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
