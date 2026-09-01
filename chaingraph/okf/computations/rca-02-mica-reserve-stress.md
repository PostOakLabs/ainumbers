---
type: Attested Computation
title: "MiCA Stablecoin Reserve Stress Simulator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the liquidity_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/rca-02-mica-reserve-stress.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/rca-02-mica-reserve-stress.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MiCA Stablecoin Reserve Stress Simulator — attested computation

> §10.2 Attested Computation binding for [MiCA Stablecoin Reserve Stress Simulator](../tools/rca-02-mica-reserve-stress.md).

## Executor

Kernel source: `chaingraph/kernels/rca-02-mica-reserve-stress.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c66896024cd7ffc75c46cdd7c67e42c929234c4c7ce4b342a372b3627a68377b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
