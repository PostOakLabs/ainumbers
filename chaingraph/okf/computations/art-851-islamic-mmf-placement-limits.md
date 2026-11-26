---
type: Attested Computation
title: "Islamic MMF Placement Limits — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-851-islamic-mmf-placement-limits.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-851-islamic-mmf-placement-limits.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Islamic MMF Placement Limits — attested computation

> §10.2 Attested Computation binding for [Islamic MMF Placement Limits](../tools/art-851-islamic-mmf-placement-limits.md).

## Executor

Kernel source: `chaingraph/kernels/art-851-islamic-mmf-placement-limits.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e5682e41688ab0c7625e83bde9262669391b3f54744afdd1243aeafe18edb41f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
