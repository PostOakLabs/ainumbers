---
type: Attested Computation
title: "CCP Default Waterfall Recomputation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-529-ccp-default-waterfall-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-529-ccp-default-waterfall-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CCP Default Waterfall Recomputation — attested computation

> §10.2 Attested Computation binding for [CCP Default Waterfall Recomputation](../tools/art-529-ccp-default-waterfall-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-529-ccp-default-waterfall-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1fa3932e10c166675cb5eaf1c41a165ee448e916df2086e1cf963e95ee4a2f97` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
