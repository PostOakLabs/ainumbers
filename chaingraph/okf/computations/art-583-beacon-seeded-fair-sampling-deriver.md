---
type: Attested Computation
title: "Beacon-Seeded Fair-Sampling Deriver — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-583-beacon-seeded-fair-sampling-deriver.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-583-beacon-seeded-fair-sampling-deriver.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Beacon-Seeded Fair-Sampling Deriver — attested computation

> §10.2 Attested Computation binding for [Beacon-Seeded Fair-Sampling Deriver](../tools/art-583-beacon-seeded-fair-sampling-deriver.md).

## Executor

Kernel source: `chaingraph/kernels/art-583-beacon-seeded-fair-sampling-deriver.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:00bf25e2ac76c12d2bc9de448a1c9d767c67581310b599637d193d2f949b708a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
