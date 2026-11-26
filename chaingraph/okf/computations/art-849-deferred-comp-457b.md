---
type: Attested Computation
title: "Deferred Comp 457(b) Comparison — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-849-deferred-comp-457b.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-849-deferred-comp-457b.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Deferred Comp 457(b) Comparison — attested computation

> §10.2 Attested Computation binding for [Deferred Comp 457(b) Comparison](../tools/art-849-deferred-comp-457b.md).

## Executor

Kernel source: `chaingraph/kernels/art-849-deferred-comp-457b.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b1e1ed4f8f1f30cdf0918caca02b958d151fd33f71d27f5ac0a2ce6ec22ddc06` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
