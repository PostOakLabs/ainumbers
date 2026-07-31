---
type: Attested Computation
title: "IHB Interest Allocation — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-260-allocate-ihb-interest.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-260-allocate-ihb-interest.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IHB Interest Allocation — attested computation

> §10.2 Attested Computation binding for [IHB Interest Allocation](../tools/art-260-allocate-ihb-interest.md).

## Executor

Kernel source: `chaingraph/kernels/art-260-allocate-ihb-interest.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6e9a9c6e57168ff88d9a4933856fe6f04ecc88942a01e7937c076d1e80235b76` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
