---
type: Attested Computation
title: "ETR Possession-Chain Receipt Builder — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the cryptographic_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-353-etr-possession-chain-builder.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-353-etr-possession-chain-builder.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ETR Possession-Chain Receipt Builder — attested computation

> §10.2 Attested Computation binding for [ETR Possession-Chain Receipt Builder](../tools/art-353-etr-possession-chain-builder.md).

## Executor

Kernel source: `chaingraph/kernels/art-353-etr-possession-chain-builder.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:13ba0669d5e6d376f027ff9d182bc9d5578a33196aa58a755e376dc29a2c4888` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
