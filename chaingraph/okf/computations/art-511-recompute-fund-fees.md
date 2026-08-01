---
type: Attested Computation
title: "Recompute Fund Fees — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-511-recompute-fund-fees.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-511-recompute-fund-fees.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Recompute Fund Fees — attested computation

> §10.2 Attested Computation binding for [Recompute Fund Fees](../tools/art-511-recompute-fund-fees.md).

## Executor

Kernel source: `chaingraph/kernels/art-511-recompute-fund-fees.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:02852a75e044e31ef50b68a146d4ffef30f3ed54d1299618963963301c82cf40` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
