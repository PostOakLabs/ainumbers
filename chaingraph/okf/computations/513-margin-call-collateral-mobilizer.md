---
type: Attested Computation
title: "Margin Call Collateral Mobilizer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/513-margin-call-collateral-mobilizer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/513-margin-call-collateral-mobilizer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Margin Call Collateral Mobilizer — attested computation

> §10.2 Attested Computation binding for [Margin Call Collateral Mobilizer](../tools/513-margin-call-collateral-mobilizer.md).

## Executor

Kernel source: `chaingraph/kernels/513-margin-call-collateral-mobilizer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d7af04d366f7112be98e4d1735226212639a7f1ffcc97014858f47e83c9c79f3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
