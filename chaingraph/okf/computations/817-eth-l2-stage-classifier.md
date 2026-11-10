---
type: Attested Computation
title: "Ethereum L2 Stage Criteria Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/817-eth-l2-stage-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/817-eth-l2-stage-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Ethereum L2 Stage Criteria Classifier — attested computation

> §10.2 Attested Computation binding for [Ethereum L2 Stage Criteria Classifier](../tools/817-eth-l2-stage-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/817-eth-l2-stage-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:eca370b7187bde0cbb1d36a7817952e7b4ad2ac4e69048edb7ceb9c5f88e5881` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
