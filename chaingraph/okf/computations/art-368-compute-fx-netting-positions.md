---
type: Attested Computation
title: "Multilateral FX Netting Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-368-compute-fx-netting-positions.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-368-compute-fx-netting-positions.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Multilateral FX Netting Calculator — attested computation

> §10.2 Attested Computation binding for [Multilateral FX Netting Calculator](../tools/art-368-compute-fx-netting-positions.md).

## Executor

Kernel source: `chaingraph/kernels/art-368-compute-fx-netting-positions.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f7c40844e14788edbc93617ffab9ff10e02f9ced7a427a11d232041defcb2f78` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
