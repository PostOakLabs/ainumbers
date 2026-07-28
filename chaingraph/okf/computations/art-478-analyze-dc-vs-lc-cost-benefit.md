---
type: Attested Computation
title: "Documentary Collection vs Letter of Credit Cost-Benefit — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-478-analyze-dc-vs-lc-cost-benefit.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-478-analyze-dc-vs-lc-cost-benefit.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Documentary Collection vs Letter of Credit Cost-Benefit — attested computation

> §10.2 Attested Computation binding for [Documentary Collection vs Letter of Credit Cost-Benefit](../tools/art-478-analyze-dc-vs-lc-cost-benefit.md).

## Executor

Kernel source: `chaingraph/kernels/art-478-analyze-dc-vs-lc-cost-benefit.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:399294433cf13af7c9c72820fff550fb25f97a09c279902523b938e2a657ff0e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
