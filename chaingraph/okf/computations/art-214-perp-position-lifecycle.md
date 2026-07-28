---
type: Attested Computation
title: "Perp Position Lifecycle — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the derivatives_margin_health decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-214-perp-position-lifecycle.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-214-perp-position-lifecycle.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Perp Position Lifecycle — attested computation

> §10.2 Attested Computation binding for [Perp Position Lifecycle](../tools/art-214-perp-position-lifecycle.md).

## Executor

Kernel source: `chaingraph/kernels/art-214-perp-position-lifecycle.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:aa963eb24ee88e725b08bbaaf443a0f756a8d42eb469f9c1fe1e68ef75dc4cf6` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
