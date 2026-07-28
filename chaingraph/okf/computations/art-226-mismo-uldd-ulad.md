---
type: Attested Computation
title: "ULDD/ULAD Structural Linter — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-226-mismo-uldd-ulad.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-226-mismo-uldd-ulad.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ULDD/ULAD Structural Linter — attested computation

> §10.2 Attested Computation binding for [ULDD/ULAD Structural Linter](../tools/art-226-mismo-uldd-ulad.md).

## Executor

Kernel source: `chaingraph/kernels/art-226-mismo-uldd-ulad.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5b09063e1cbd268666c288bd86047df127316f8a8e314b985ea89b240bc4ac13` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
