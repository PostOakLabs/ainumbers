---
type: Attested Computation
title: "Linea L2 Finality Window Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-290-check-linea-l2-finality-window.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-290-check-linea-l2-finality-window.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Linea L2 Finality Window Classifier — attested computation

> §10.2 Attested Computation binding for [Linea L2 Finality Window Classifier](../tools/art-290-check-linea-l2-finality-window.md).

## Executor

Kernel source: `chaingraph/kernels/art-290-check-linea-l2-finality-window.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:96bc4cfa0b4c4dc33183c6c6c36cb074ef7ecf0c8a4e10dbd7552fefa7eeeb97` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
