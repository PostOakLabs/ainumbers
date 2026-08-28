---
type: Attested Computation
title: "Perp Funding Implied Yield — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the perp_funding_rate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-654-perp-funding-implied-yield.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-654-perp-funding-implied-yield.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Perp Funding Implied Yield — attested computation

> §10.2 Attested Computation binding for [Perp Funding Implied Yield](../tools/art-654-perp-funding-implied-yield.md).

## Executor

Kernel source: `chaingraph/kernels/art-654-perp-funding-implied-yield.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d10783401eec2998aef2e27c245e97fc78632f94a25943c54ecca3ccec527663` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
