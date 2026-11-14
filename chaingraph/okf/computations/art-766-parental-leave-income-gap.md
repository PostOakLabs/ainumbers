---
type: Attested Computation
title: "Parental Leave Income Gap — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the career_workforce decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-766-parental-leave-income-gap.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-766-parental-leave-income-gap.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Parental Leave Income Gap — attested computation

> §10.2 Attested Computation binding for [Parental Leave Income Gap](../tools/art-766-parental-leave-income-gap.md).

## Executor

Kernel source: `chaingraph/kernels/art-766-parental-leave-income-gap.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ef9a4ec29eef07d640c289044905539ac573ff080da3fb6a8d1b80148db52056` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
