---
type: Attested Computation
title: "Transfer-Pricing Interquartile Range Benchmark — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-473-interquartile-benchmark.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-473-interquartile-benchmark.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Transfer-Pricing Interquartile Range Benchmark — attested computation

> §10.2 Attested Computation binding for [Transfer-Pricing Interquartile Range Benchmark](../tools/art-473-interquartile-benchmark.md).

## Executor

Kernel source: `chaingraph/kernels/art-473-interquartile-benchmark.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cb1ba5cdbe3498d0233716df24c81eefbc4b95386d57e76991a0c0c005b48f49` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
