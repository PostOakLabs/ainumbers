---
type: Attested Computation
title: "Omnibus Token Position Reconciliation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-828-reconcile-omnibus-token-position.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-828-reconcile-omnibus-token-position.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Omnibus Token Position Reconciliation — attested computation

> §10.2 Attested Computation binding for [Omnibus Token Position Reconciliation](../tools/art-828-reconcile-omnibus-token-position.md).

## Executor

Kernel source: `chaingraph/kernels/art-828-reconcile-omnibus-token-position.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:244e06c7cefd3bae92387a5258f61abacd8262681516cdeb488e318b1cf588bf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
