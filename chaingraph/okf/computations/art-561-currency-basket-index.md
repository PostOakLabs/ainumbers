---
type: Attested Computation
title: "Currency Basket Index — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the currency_basket_index decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-561-currency-basket-index.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-561-currency-basket-index.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Currency Basket Index — attested computation

> §10.2 Attested Computation binding for [Currency Basket Index](../tools/art-561-currency-basket-index.md).

## Executor

Kernel source: `chaingraph/kernels/art-561-currency-basket-index.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:84f9b197e0b2e11acc54f7bb0ac50a30db1e80f22e33238395093d9ac9887921` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
