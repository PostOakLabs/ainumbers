---
type: Attested Computation
title: "Total Cost of Homeownership — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the consumer_finance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-770-total-cost-of-homeownership.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-770-total-cost-of-homeownership.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Total Cost of Homeownership — attested computation

> §10.2 Attested Computation binding for [Total Cost of Homeownership](../tools/art-770-total-cost-of-homeownership.md).

## Executor

Kernel source: `chaingraph/kernels/art-770-total-cost-of-homeownership.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6ff9267e9f0d21e4d41ddfd58002d583a93cb9b1a0bbde24df335df244c38f71` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
