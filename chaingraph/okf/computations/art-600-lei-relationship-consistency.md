---
type: Attested Computation
title: "LEI Relationship Consistency Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-600-lei-relationship-consistency.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-600-lei-relationship-consistency.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# LEI Relationship Consistency Checker — attested computation

> §10.2 Attested Computation binding for [LEI Relationship Consistency Checker](../tools/art-600-lei-relationship-consistency.md).

## Executor

Kernel source: `chaingraph/kernels/art-600-lei-relationship-consistency.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5f6da9c921850504efa9bfc5e8e7f0e2bd92ee4271a81a8eb7d71e7a4dd60b96` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
