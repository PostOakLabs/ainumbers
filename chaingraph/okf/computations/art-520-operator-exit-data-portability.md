---
type: Attested Computation
title: "Operator Exit & Data Portability — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-520-operator-exit-data-portability.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-520-operator-exit-data-portability.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Operator Exit & Data Portability — attested computation

> §10.2 Attested Computation binding for [Operator Exit & Data Portability](../tools/art-520-operator-exit-data-portability.md).

## Executor

Kernel source: `chaingraph/kernels/art-520-operator-exit-data-portability.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f788f6feb29648cf1c09156f55bc79fa0da7511e5ce55547e00b893c8f6e826b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
