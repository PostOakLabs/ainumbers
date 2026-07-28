---
type: Attested Computation
title: "Cross-Border B2B Fee Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-367-compute-cross-border-fees.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-367-compute-cross-border-fees.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cross-Border B2B Fee Calculator — attested computation

> §10.2 Attested Computation binding for [Cross-Border B2B Fee Calculator](../tools/art-367-compute-cross-border-fees.md).

## Executor

Kernel source: `chaingraph/kernels/art-367-compute-cross-border-fees.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ab7cc7c6345a21988fca592f503a6b89a4ddc3fe97267f8996170f1021619817` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
