---
type: Attested Computation
title: "TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the treasury_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-389-tempo-mainnet-fee-capacity.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-389-tempo-mainnet-fee-capacity.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator — attested computation

> §10.2 Attested Computation binding for [TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator](../tools/art-389-tempo-mainnet-fee-capacity.md).

## Executor

Kernel source: `chaingraph/kernels/art-389-tempo-mainnet-fee-capacity.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cfa8b47b776f0402746e4968070394d060291ee3afe265412a07fcd2018194ac` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
