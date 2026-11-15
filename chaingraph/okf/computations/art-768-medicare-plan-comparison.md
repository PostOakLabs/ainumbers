---
type: Attested Computation
title: "Medicare Plan Comparison — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the medicare_plan_comparison_record decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-768-medicare-plan-comparison.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-768-medicare-plan-comparison.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Medicare Plan Comparison — attested computation

> §10.2 Attested Computation binding for [Medicare Plan Comparison](../tools/art-768-medicare-plan-comparison.md).

## Executor

Kernel source: `chaingraph/kernels/art-768-medicare-plan-comparison.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1484250d3fddfc6ee88c17bc0308f135f4e58922497b12f97d1003ae038b4fdd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
