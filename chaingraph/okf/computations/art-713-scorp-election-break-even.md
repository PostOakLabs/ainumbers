---
type: Attested Computation
title: "S-Corp Election Break-Even Modeler — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the readiness_diagnostic decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-713-scorp-election-break-even.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-713-scorp-election-break-even.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# S-Corp Election Break-Even Modeler — attested computation

> §10.2 Attested Computation binding for [S-Corp Election Break-Even Modeler](../tools/art-713-scorp-election-break-even.md).

## Executor

Kernel source: `chaingraph/kernels/art-713-scorp-election-break-even.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1bb9d5ca33af735aa4f78452b9d65830fbda1cbfa378ea90dcc3ccea6a270b8f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
