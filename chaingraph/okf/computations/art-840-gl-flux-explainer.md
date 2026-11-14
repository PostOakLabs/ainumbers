---
type: Attested Computation
title: "GL Flux Explainer with Gate — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the assurance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-840-gl-flux-explainer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-840-gl-flux-explainer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GL Flux Explainer with Gate — attested computation

> §10.2 Attested Computation binding for [GL Flux Explainer with Gate](../tools/art-840-gl-flux-explainer.md).

## Executor

Kernel source: `chaingraph/kernels/art-840-gl-flux-explainer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7c48e57354229f5ef96cf3591d3c7aad4260ce5d1aefecb61e9ab06bd3607e4e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
