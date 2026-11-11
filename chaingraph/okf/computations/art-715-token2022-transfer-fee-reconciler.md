---
type: Attested Computation
title: "Token-2022 Transfer-Fee Payment Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-715-token2022-transfer-fee-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-715-token2022-transfer-fee-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Token-2022 Transfer-Fee Payment Reconciler — attested computation

> §10.2 Attested Computation binding for [Token-2022 Transfer-Fee Payment Reconciler](../tools/art-715-token2022-transfer-fee-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/art-715-token2022-transfer-fee-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c414a3768622106b76dff42ac67c64552af24be5aae08474f240c16e0f676cdc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
