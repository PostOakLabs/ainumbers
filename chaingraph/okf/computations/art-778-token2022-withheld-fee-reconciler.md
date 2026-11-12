---
type: Attested Computation
title: "Token-2022 Withheld-Fee Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-778-token2022-withheld-fee-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-778-token2022-withheld-fee-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Token-2022 Withheld-Fee Reconciler — attested computation

> §10.2 Attested Computation binding for [Token-2022 Withheld-Fee Reconciler](../tools/art-778-token2022-withheld-fee-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/art-778-token2022-withheld-fee-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7a3439e0dec0a2b4f853b0e62b3ae84f881f7f7ef933bc83a442052570449d63` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
