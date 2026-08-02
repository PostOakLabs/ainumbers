---
type: Attested Computation
title: "N-Way Balance Closure Check — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-525-nway-balance-closure-check.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-525-nway-balance-closure-check.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# N-Way Balance Closure Check — attested computation

> §10.2 Attested Computation binding for [N-Way Balance Closure Check](../tools/art-525-nway-balance-closure-check.md).

## Executor

Kernel source: `chaingraph/kernels/art-525-nway-balance-closure-check.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:43bb37390c65a71cf845232d1f01cd24d40f3ddadba827618355b0386bfb82c9` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
