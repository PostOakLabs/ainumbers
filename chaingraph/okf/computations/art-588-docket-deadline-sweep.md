---
type: Attested Computation
title: "Docket Deadline Sweep — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-588-docket-deadline-sweep.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-588-docket-deadline-sweep.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Docket Deadline Sweep — attested computation

> §10.2 Attested Computation binding for [Docket Deadline Sweep](../tools/art-588-docket-deadline-sweep.md).

## Executor

Kernel source: `chaingraph/kernels/art-588-docket-deadline-sweep.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:54ec1d5b6fe7faac635820bc4b60de9ea75ea643abec9d1f312b6f54de3125fa` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
