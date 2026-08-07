---
type: Attested Computation
title: "Section 16(b) Short-Swing Profit Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-573-section16b-short-swing-profit-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-573-section16b-short-swing-profit-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Section 16(b) Short-Swing Profit Recomputation — attested computation

> §10.2 Attested Computation binding for [Section 16(b) Short-Swing Profit Recomputation](../tools/art-573-section16b-short-swing-profit-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-573-section16b-short-swing-profit-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2bf576ae353041e722a9e64447d9484503c9d7208b320a9338562368f15e41d2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
