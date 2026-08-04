---
type: Attested Computation
title: "Corporate Action Entitlement Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-547-corporate-action-entitlement-recompute.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-547-corporate-action-entitlement-recompute.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Corporate Action Entitlement Recompute — attested computation

> §10.2 Attested Computation binding for [Corporate Action Entitlement Recompute](../tools/art-547-corporate-action-entitlement-recompute.md).

## Executor

Kernel source: `chaingraph/kernels/art-547-corporate-action-entitlement-recompute.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:426290aa93af154925c8418526e40ce47f1ccab54eb19febae4774c50041c1b3` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
