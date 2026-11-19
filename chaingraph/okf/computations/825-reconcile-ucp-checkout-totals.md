---
type: Attested Computation
title: "Reconcile UCP Checkout Totals — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/825-reconcile-ucp-checkout-totals.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/825-reconcile-ucp-checkout-totals.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Reconcile UCP Checkout Totals — attested computation

> §10.2 Attested Computation binding for [Reconcile UCP Checkout Totals](../tools/825-reconcile-ucp-checkout-totals.md).

## Executor

Kernel source: `chaingraph/kernels/825-reconcile-ucp-checkout-totals.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a24da39dcf5cba0e968816f18137eb2f1d2bcf3c635670dabf875df78827dc6e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
