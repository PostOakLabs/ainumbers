---
type: Attested Computation
title: "Segregation-of-Duties Matrix Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-459-sod-matrix-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-459-sod-matrix-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Segregation-of-Duties Matrix Checker — attested computation

> §10.2 Attested Computation binding for [Segregation-of-Duties Matrix Checker](../tools/art-459-sod-matrix-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-459-sod-matrix-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:991bda6ad22de1f56d310c7cfbe98b6a7a9e4fdace9805007b0cc161d05cd7cd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
