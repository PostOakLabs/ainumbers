---
type: Attested Computation
title: "Canton App-Reward Estimator (CIP-0104) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-392-compute-canton-app-reward-estimate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-392-compute-canton-app-reward-estimate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Canton App-Reward Estimator (CIP-0104) — attested computation

> §10.2 Attested Computation binding for [Canton App-Reward Estimator (CIP-0104)](../tools/art-392-compute-canton-app-reward-estimate.md).

## Executor

Kernel source: `chaingraph/kernels/art-392-compute-canton-app-reward-estimate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a70be49eac55d78f34ee302aac5107512ea2f745d7ae0aeb0753644fac701c2f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
