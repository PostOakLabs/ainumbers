---
type: Attested Computation
title: "GloBE Jurisdictional ETR Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-454-globe-jurisdictional-etr.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-454-globe-jurisdictional-etr.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Jurisdictional ETR Calculator — attested computation

> §10.2 Attested Computation binding for [GloBE Jurisdictional ETR Calculator](../tools/art-454-globe-jurisdictional-etr.md).

## Executor

Kernel source: `chaingraph/kernels/art-454-globe-jurisdictional-etr.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b6c161f165c164256e1d59d3de2d7b967aa272e972f8ad8d17648dbb1066ab78` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
