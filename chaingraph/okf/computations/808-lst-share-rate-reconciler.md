---
type: Attested Computation
title: "Liquid-Staking Share Rate Reconciler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/808-lst-share-rate-reconciler.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/808-lst-share-rate-reconciler.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Liquid-Staking Share Rate Reconciler — attested computation

> §10.2 Attested Computation binding for [Liquid-Staking Share Rate Reconciler](../tools/808-lst-share-rate-reconciler.md).

## Executor

Kernel source: `chaingraph/kernels/808-lst-share-rate-reconciler.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f6044ca84c60dfa9079d6d27691a8f235605ba96458294298aaa0f4e6dc9a8ad` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
