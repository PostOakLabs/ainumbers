---
type: Attested Computation
title: "GloBE Information Return (GIR) Composer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-457-globe-gir-composer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-457-globe-gir-composer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Information Return (GIR) Composer — attested computation

> §10.2 Attested Computation binding for [GloBE Information Return (GIR) Composer](../tools/art-457-globe-gir-composer.md).

## Executor

Kernel source: `chaingraph/kernels/art-457-globe-gir-composer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:61563ff21326052fe8cd8c86671ef2bcce3ffd879f7ea28ae2f4fc8c333513a2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
