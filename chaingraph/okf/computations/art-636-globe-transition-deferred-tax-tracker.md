---
type: Attested Computation
title: "GloBE Article 9.1 Transition Deferred Tax Tracker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-636-globe-transition-deferred-tax-tracker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-636-globe-transition-deferred-tax-tracker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# GloBE Article 9.1 Transition Deferred Tax Tracker — attested computation

> §10.2 Attested Computation binding for [GloBE Article 9.1 Transition Deferred Tax Tracker](../tools/art-636-globe-transition-deferred-tax-tracker.md).

## Executor

Kernel source: `chaingraph/kernels/art-636-globe-transition-deferred-tax-tracker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e169d6aa944749b9901ee5551ceac66d0aa1aabd278d1b6d5262313806bfa9c3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
