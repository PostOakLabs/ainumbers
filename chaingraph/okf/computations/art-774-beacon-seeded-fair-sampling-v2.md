---
type: Attested Computation
title: "Beacon-Seeded Fair-Sampling Deriver V2 — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-774-beacon-seeded-fair-sampling-v2.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-774-beacon-seeded-fair-sampling-v2.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Beacon-Seeded Fair-Sampling Deriver V2 — attested computation

> §10.2 Attested Computation binding for [Beacon-Seeded Fair-Sampling Deriver V2](../tools/art-774-beacon-seeded-fair-sampling-v2.md).

## Executor

Kernel source: `chaingraph/kernels/art-774-beacon-seeded-fair-sampling-v2.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:225a33c9b312d9564601be3adb3aaf90e35f077f3d2352d63ad7a9dc9d55b102` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
