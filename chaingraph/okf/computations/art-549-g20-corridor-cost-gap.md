---
type: Attested Computation
title: "G20/FSB Corridor Cost-Gap Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the risk_parameter decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-549-g20-corridor-cost-gap.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-549-g20-corridor-cost-gap.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# G20/FSB Corridor Cost-Gap Calculator — attested computation

> §10.2 Attested Computation binding for [G20/FSB Corridor Cost-Gap Calculator](../tools/art-549-g20-corridor-cost-gap.md).

## Executor

Kernel source: `chaingraph/kernels/art-549-g20-corridor-cost-gap.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:466123f62f6e6d1ee5414ed2b8d39004b3677e2cac5a9934c3c146bb1568975d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
