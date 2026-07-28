---
type: Attested Computation
title: "NMD Behavioral Repricing Mapper — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-442-nmd-behavioral-repricing-mapper.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-442-nmd-behavioral-repricing-mapper.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NMD Behavioral Repricing Mapper — attested computation

> §10.2 Attested Computation binding for [NMD Behavioral Repricing Mapper](../tools/art-442-nmd-behavioral-repricing-mapper.md).

## Executor

Kernel source: `chaingraph/kernels/art-442-nmd-behavioral-repricing-mapper.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:388900a314f4d9e05be9bfcf9909a1b89a67b9c482c057d9434cb200f7bef94d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
