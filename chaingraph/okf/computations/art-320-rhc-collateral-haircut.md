---
type: Attested Computation
title: "Halt + Staleness Collateral Haircut — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the collateral_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-320-rhc-collateral-haircut.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-320-rhc-collateral-haircut.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Halt + Staleness Collateral Haircut — attested computation

> §10.2 Attested Computation binding for [Halt + Staleness Collateral Haircut](../tools/art-320-rhc-collateral-haircut.md).

## Executor

Kernel source: `chaingraph/kernels/art-320-rhc-collateral-haircut.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fd8a869feabce17a886f3ccfab9cd1934a02f866b36883269c186a0af544c5a0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
