---
type: Attested Computation
title: "Agreement Acceptance Binder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-277-agreement-acceptance-binder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-277-agreement-acceptance-binder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Agreement Acceptance Binder — attested computation

> §10.2 Attested Computation binding for [Agreement Acceptance Binder](../tools/art-277-agreement-acceptance-binder.md).

## Executor

Kernel source: `chaingraph/kernels/art-277-agreement-acceptance-binder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f89876aa4e8bd2c8202f42f53375dcaadcf311417577d08361dc752421a2a965` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
