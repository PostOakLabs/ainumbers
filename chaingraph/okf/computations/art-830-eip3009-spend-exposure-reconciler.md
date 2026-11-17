---
type: Attested Computation
title: "EIP-3009 Spend Exposure Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-830-eip3009-spend-exposure-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-830-eip3009-spend-exposure-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EIP-3009 Spend Exposure Reconciler — attested computation

> §10.2 Attested Computation binding for [EIP-3009 Spend Exposure Reconciler](../tools/art-830-eip3009-spend-exposure-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/art-830-eip3009-spend-exposure-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:efd4e9216f23a4af29fb30e2bac8e020fb1eda46c218b7e77a7f35f3e3b1f87d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
