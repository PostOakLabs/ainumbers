---
type: Attested Computation
title: "15c3-3 Customer Reserve Formula Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-396-compute-15c3-3-reserve.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-396-compute-15c3-3-reserve.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# 15c3-3 Customer Reserve Formula Calculator — attested computation

> §10.2 Attested Computation binding for [15c3-3 Customer Reserve Formula Calculator](../tools/art-396-compute-15c3-3-reserve.md).

## Executor

Kernel source: `chaingraph/kernels/art-396-compute-15c3-3-reserve.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4d4f69e7fa90f1983449c71e85bbf2446e5dae6ee6b77249b04fa5f8f891223a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
