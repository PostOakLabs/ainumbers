---
type: Attested Computation
title: "Bank Reconciliation Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-835-bank-reconciliation-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-835-bank-reconciliation-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Bank Reconciliation Recompute — attested computation

> §10.2 Attested Computation binding for [Bank Reconciliation Recompute](../tools/art-835-bank-reconciliation-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-835-bank-reconciliation-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b3e7e01f5b854caaa5d8988fa47fb8f12c0cffd3db36c5e647b35b788bc5fcea` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
