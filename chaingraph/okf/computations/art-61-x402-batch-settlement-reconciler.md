---
type: Attested Computation
title: "x402 V2 Batch-Settlement Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-61-x402-batch-settlement-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-61-x402-batch-settlement-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 V2 Batch-Settlement Reconciler — attested computation

> §10.2 Attested Computation binding for [x402 V2 Batch-Settlement Reconciler](../tools/art-61-x402-batch-settlement-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/art-61-x402-batch-settlement-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:93f57377ae56edc40fdb3e1381a0bc126350b4fa9584d9b59a931175ef17d054` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
