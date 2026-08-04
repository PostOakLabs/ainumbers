---
type: Attested Computation
title: "Member Margin Call Lifecycle — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-531-member-margin-call-lifecycle.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-531-member-margin-call-lifecycle.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Member Margin Call Lifecycle — attested computation

> §10.2 Attested Computation binding for [Member Margin Call Lifecycle](../tools/art-531-member-margin-call-lifecycle.md).

## Executor

Kernel source: `chaingraph/kernels/art-531-member-margin-call-lifecycle.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:89fcc33e4e1a9e74da13cd69954a8b4d1717cf652e2159dd4c358b0ee59b436b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
