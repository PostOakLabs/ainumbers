---
type: Attested Computation
title: "No-Russia-Clause Pack Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the disclosure_template decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-96-no-russia-clause-pack-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-96-no-russia-clause-pack-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# No-Russia-Clause Pack Builder — attested computation

> §10.2 Attested Computation binding for [No-Russia-Clause Pack Builder](../tools/art-96-no-russia-clause-pack-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-96-no-russia-clause-pack-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cf2d6111233a0f8a580756c5e1c03e7832d67ddf9c6582393a9c90d819dbaa7a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
